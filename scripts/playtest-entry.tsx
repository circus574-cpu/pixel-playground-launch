import { createRoot } from "react-dom/client";
import { LegacyIndex as Index } from "../src/routes/index";
createRoot(document.getElementById("app")!).render(<Index />);
