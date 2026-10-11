import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import zlib from "node:zlib";
import plist from "plist";
import { readIpa, inspectSignedIpa, IpaError } from "../lib/ipa/parse";
import { toStandardPng } from "../lib/ipa/png";
import { parseProfile, profileCoversBundle } from "../lib/ipa/profile";
import { checkSigningInputs } from "../lib/ipa/validate";

function makePlainPng(width: number, height: number, rgba: number[]): Buffer {
  // rgba: width*height*4 bytes, row-major, straight alpha. Filter 0 per row.
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let i = 0; i < stride; i++) raw[y * (stride + 1) + 1 + i] = rgba[y * stride + i];
  }
  return encodePng(width, height, zlib.deflateSync(raw), null);
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type, "latin1"), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

function encodePng(width: number, height: number, idat: Buffer, cgbi: Buffer | null): Buffer {
  const ihdr: Buffer = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const parts: Buffer[] = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  if (cgbi) parts.push(chunk("CgBI", cgbi));
  parts.push(chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/** Apple-style CgBI PNG: BGRA, premultiplied alpha, raw deflate (no zlib header). */
function makeCgbiPng(width: number, height: number, bgra: number[]): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let i = 0; i < stride; i++) raw[y * (stride + 1) + 1 + i] = bgra[y * stride + i];
  }
  const idat = zlib.deflateRawSync(raw);
  return encodePng(width, height, idat, Buffer.from([0, 0, 0, 0]));
}

function decodeRgba(png: Buffer): { width: number; height: number; pixels: Buffer } {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  let off = 8;
  const idats: Buffer[] = [];
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString("latin1", off + 4, off + 8);
    if (type === "IDAT") idats.push(png.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) raw.copy(pixels, y * stride, y * (stride + 1) + 1, (y + 1) * (stride + 1));
  return { width, height, pixels };
}

describe("CgBI icon conversion", () => {
  it("converts premultiplied BGRA to straight RGBA", () => {
    // Pixel 1: BGRA(100, 50, 200, 255) opaque -> RGBA(200, 50, 100, 255)
    // Pixel 2: BGRA(0, 0, 0, 0) transparent -> RGBA(0, 0, 0, 0)
    // Pixel 3: premultiplied half-alpha BGRA(0, 0, 64, 128) -> RGBA(128, 0, 0, 128)
    const bgra = [100, 50, 200, 255, 0, 0, 0, 0, 0, 0, 64, 128];
    const png = makeCgbiPng(3, 1, bgra);
    const out = decodeRgba(toStandardPng(png));
    expect([...out.pixels.subarray(0, 4)]).toEqual([200, 50, 100, 255]);
    expect([...out.pixels.subarray(4, 8)]).toEqual([0, 0, 0, 0]);
    expect([...out.pixels.subarray(8, 12)]).toEqual([128, 0, 0, 128]);
  });

  it("returns ordinary PNGs unchanged", () => {
    const png = makePlainPng(1, 1, [1, 2, 3, 255]);
    expect(toStandardPng(png).equals(png)).toBe(true);
  });
});

function makeIpa(opts: { bundleId?: string; icon?: Buffer; signed?: boolean; infoBinary?: boolean } = {}): Buffer {
  const info = {
    CFBundleIdentifier: opts.bundleId ?? "com.example.demo",
    CFBundleDisplayName: "Demo App",
    CFBundleShortVersionString: "2.4.0",
    CFBundleVersion: "118",
    CFBundleExecutable: "Demo",
    MinimumOSVersion: "15.0",
    UIDeviceFamily: [1, 2],
    CFBundleIcons: { CFBundlePrimaryIcon: { CFBundleIconFiles: ["AppIcon60x60"] } },
  };
  const files: Record<string, Uint8Array> = {
    "Payload/Demo.app/Demo": strToU8("binary"),
    "Payload/Demo.app/Info.plist": opts.infoBinary ? strToU8("unused") : strToU8(plist.build(info)),
  };
  if (opts.icon) files["Payload/Demo.app/AppIcon60x60@2x.png"] = opts.icon;
  if (opts.signed) files["Payload/Demo.app/_CodeSignature/CodeResources"] = strToU8("<plist/>");
  return Buffer.from(zipSync(files));
}

describe("readIpa", () => {
  it("extracts bundle id, name, version, build, devices and icon", () => {
    const icon = makeCgbiPng(2, 2, new Array(16).fill(255));
    const info = readIpa(makeIpa({ icon }));
    expect(info.bundleId).toBe("com.example.demo");
    expect(info.name).toBe("Demo App");
    expect(info.version).toBe("2.4.0");
    expect(info.build).toBe("118");
    expect(info.minIos).toBe("15.0");
    expect(info.devices).toEqual(["iPhone", "iPad"]);
    expect(info.executable).toBe("Demo");
    expect(info.sizeBytes).toBeGreaterThan(0);
    expect(info.sha256).toHaveLength(64);
    expect(info.alreadySigned).toBe(false);
    expect(info.icon?.subarray(1, 4).toString()).toBe("PNG");
  });

  it("detects an already signed IPA and returns null icon when none is shipped", () => {
    const info = readIpa(makeIpa({ signed: true }));
    expect(info.alreadySigned).toBe(true);
    expect(info.icon).toBeNull();
  });

  it("rejects non-zip input and IPAs without Info.plist", () => {
    expect(() => readIpa(Buffer.from("not a zip at all"))).toThrow(IpaError);
    const empty = Buffer.from(zipSync({ "readme.txt": strToU8("x") }));
    expect(() => readIpa(empty)).toThrow(/Info\.plist/);
  });
});

describe("profile parsing and signing rules", () => {
  function profileXml(overrides: Record<string, unknown> = {}): Buffer {
    const body = {
      Name: "Demo AdHoc",
      UUID: "9f2c1a00-0000-4000-8000-000000000001",
      TeamIdentifier: ["ABCDE12345"],
      ExpirationDate: new Date(Date.now() + 90 * 86_400_000),
      ProvisionedDevices: ["00008110-000A11220C00801E", "00008110-000A11220C00801F"],
      Entitlements: { "application-identifier": "ABCDE12345.com.example.*", "get-task-allow": false },
      DeveloperCertificates: [Buffer.from("fake-der-cert")],
      ...overrides,
    };
    // Simulate the CMS envelope: binary junk before and after the XML payload.
    const xml = plist.build(Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)));
    return Buffer.concat([Buffer.from([0x30, 0x80, 0x06, 0x09]), Buffer.from(xml, "utf8"), Buffer.from([0, 0, 0xff])]);
  }

  it("reads type, team, devices, and certificate fingerprints from an ad-hoc profile", () => {
    const p = parseProfile(profileXml());
    expect(p.distribution).toBe("ad-hoc");
    expect(p.teamId).toBe("ABCDE12345");
    expect(p.deviceCount).toBe(2);
    expect(p.uuid).toBe("9F2C1A00-0000-4000-8000-000000000001");
    expect(p.certFingerprints).toHaveLength(1);
  });

  it("classifies enterprise, development, and app-store profiles", () => {
    expect(parseProfile(profileXml({ ProvisionsAllDevices: true, ProvisionedDevices: undefined })).distribution).toBe("enterprise");
    expect(
      parseProfile(profileXml({ Entitlements: { "application-identifier": "ABCDE12345.com.example.*", "get-task-allow": true } })).distribution,
    ).toBe("development");
    expect(parseProfile(profileXml({ ProvisionedDevices: undefined })).distribution).toBe("app-store");
  });

  it("matches wildcard and exact app identifiers", () => {
    expect(profileCoversBundle("ABCDE12345.*", "anything.goes")).toBe(true);
    expect(profileCoversBundle("ABCDE12345.com.example.*", "com.example.demo")).toBe(true);
    expect(profileCoversBundle("ABCDE12345.com.example.demo", "com.example.demo")).toBe(true);
    expect(profileCoversBundle("ABCDE12345.com.example.demo", "com.example.other")).toBe(false);
  });

  it("rejects a file that is not a provisioning profile", () => {
    expect(() => parseProfile(Buffer.from("just text"))).toThrow(/plist/);
  });

  const base = {
    bundleId: "com.example.demo",
    now: new Date("2026-06-01T00:00:00Z"),
    profile: {
      uuid: "U",
      teamId: "ABCDE12345",
      appIdentifier: "ABCDE12345.com.example.*",
      distribution: "ad-hoc" as const,
      notAfter: new Date("2027-01-01T00:00:00Z"),
      deviceCount: 2,
      certFingerprints: ["fp1"],
      disabled: false,
    },
    certificate: {
      teamId: "ABCDE12345",
      kind: "distribution" as const,
      fingerprint: "fp1",
      notAfter: new Date("2027-01-01T00:00:00Z"),
      disabled: false,
    },
  };

  it("accepts a matching distribution cert and ad-hoc profile", () => {
    expect(checkSigningInputs(base)).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it("blocks expired profiles, mismatched teams, foreign certificates and bundle mismatches", () => {
    expect(checkSigningInputs({ ...base, now: new Date("2028-01-01T00:00:00Z") }).ok).toBe(false);
    expect(checkSigningInputs({ ...base, certificate: { ...base.certificate, teamId: "ZZZZZ99999" } }).errors.join(" ")).toMatch(/Team ID/);
    expect(checkSigningInputs({ ...base, certificate: { ...base.certificate, fingerprint: "other" } }).errors.join(" ")).toMatch(/ضمن/);
    expect(checkSigningInputs({ ...base, bundleId: "com.other.app" }).errors.join(" ")).toMatch(/Bundle ID/);
  });

  it("requires a development cert for development profiles and warns for app-store profiles", () => {
    const devProfile = { ...base, profile: { ...base.profile, distribution: "development" as const } };
    expect(checkSigningInputs(devProfile).errors.join(" ")).toMatch(/Development/);
    const store = { ...base, profile: { ...base.profile, distribution: "app-store" as const } };
    expect(checkSigningInputs(store).warnings.join(" ")).toMatch(/TestFlight/);
  });
});

describe("inspectSignedIpa", () => {
  it("reads bundle id, embedded profile UUID and code resources from a signed IPA", () => {
    const uuid = "9F2C1A00-0000-4000-8000-000000000001";
    const signed = Buffer.from(
      zipSync({
        "Payload/Demo.app/Info.plist": strToU8(plist.build({ CFBundleIdentifier: "com.example.demo" })),
        "Payload/Demo.app/embedded.mobileprovision": strToU8(`junk<key>UUID</key>\n<string>${uuid}</string>junk`),
        "Payload/Demo.app/_CodeSignature/CodeResources": strToU8("<plist/>"),
      }),
    );
    expect(inspectSignedIpa(signed)).toEqual({
      bundleId: "com.example.demo",
      embeddedProfileUuid: uuid,
      hasCodeResources: true,
    });
  });
});
