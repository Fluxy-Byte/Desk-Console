import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { PersistGate } from "redux-persist/integration/react";
import { SWRConfig } from "swr";
import { Toaster } from "sonner";
import { App } from "./App";
import { fetcher } from "./lib/fetcher";
import { persistor, store } from "./store/store";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SWRConfig value={{ fetcher }}>
          <BrowserRouter>
            <App />
            <Toaster richColors position="top-right" />
          </BrowserRouter>
        </SWRConfig>
      </PersistGate>
    </Provider>
  </StrictMode>,
);
