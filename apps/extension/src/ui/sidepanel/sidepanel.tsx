import ReactDOM from "react-dom/client";
import ShellApp from "./shell/App";
// Use compiled CSS (index.css) instead of source (globals.css).
// globals.css contains Tailwind directives (@apply, @theme) that require processing.
import "./shell/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(<ShellApp />);
