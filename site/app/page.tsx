import { Home } from "../components/Store";
import { catalog } from "../lib/catalog";

export default function StorePage() {
  return <Home catalog={catalog} />;
}
