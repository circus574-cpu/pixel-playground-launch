import { createRoot } from "react-dom/client";
import { AdminWorldEditor } from "../src/components/admin/AdminWorldEditor";
import "../src/components/account/account.css";
createRoot(document.getElementById("app")!).render(<AdminWorldEditor />);
