---
sidebar_position: 2
---

# Provide the store

To provide the store [you just created](./store-and-state) to all your app,
import the `StoreProvider` component from `kiss-for-react` and wrap your app with it.

Note your code should have a **single** store provider, at the top of your component tree.

Then, pass the **store** as a prop to the `StoreProvider`.

```tsx title="index.tsx"
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```tsx title="App.tsx"
import React from "react";
import { createStore, StoreProvider } from "kiss-for-react";
import State from "./State";

const store = createStore<State>({ initialState: ... });

function App() {
  return (
    <StoreProvider store={store}>
      <AppContent />
    </StoreProvider>
  );
};
```

Create the store outside the components, as above, so that it lives for the whole app. If the
`store` prop changes, the components below switch to the new store: they stop listening to the
old one, read the new one right away, and the `useStoreEffect` callbacks run `onUnmount` for the
old store and `onMount` for the new one.

## Server-side rendering

Kiss works with `renderToString` and `hydrateRoot`. Create one store per request, so that
requests don't share state.

On the server, the HTML shows the `initialState` the store was created with. If you dispatch
actions before rendering, wait for them to finish, and pass the state to render as
`serverState`:

```tsx
const store = createStore<State>({ initialState: new State(), server: true });
await store.dispatchAndWait(new LoadData());
const html = renderToString(
  <StoreProvider store={store} serverState={store.state}>
    <App />
  </StoreProvider>
);
const transfer = serialize(store.state); // Put it in the HTML, for the client.
```

On the client, create the store with the state transferred from the server, and hydrate. React
needs to render exactly what the HTML shows, so if the client store may have changed before
hydrating (for example, a persistor restored a newer state), pass the transferred state as
`serverState`. After hydration, the components catch up with the live state:

```tsx
const store = createStore<State>({ initialState: deserialize(transfer) });
hydrateRoot(
  document.getElementById('root')!,
  <StoreProvider store={store} serverState={store.state}>
    <App />
  </StoreProvider>
);
```

Rebuild the same state on the client that the server rendered: for a plain object, JSON is
enough; for class instances, `Map`s and `Set`s, use your own `toJSON`/`fromJSON` code, or the
serializer you use for persistence.

On the server and while hydrating, `useIsWaiting` and `useIsFailed` are `false`,
`useExceptionFor` is `null`, `useSuspense` never suspends or throws, and `useIsStoreReady` is
`true`: the HTML never shows an action in progress, a failed action, or a store that is not
ready. After hydration, these hooks follow the live store. So, on the server, wait for your
actions to finish before rendering.

The server store is created with `server: true`: the actions that poll, retry or debounce on
the client run once there, and start no timers. After rendering, dispose it with
`store.dispose()`. See [Server-side rendering](../miscellaneous/server-side-rendering) for the
details, Next.js, streaming, and the persistor.

## Try it out

<iframe
src="https://codesandbox.io/embed/w8djq4?view=editor&module=%2Fsrc%2FApp.tsx&hidenavigation=1&fontsize=12.5&editorsize=70&previewwindow=browser&hidedevtools=1&hidenavigation=1"
style={{ width:'100%', height: '400px', borderRight:'1px solid black' }}
title="counter-async-redux-example"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
/>

<hr></hr>

Next, let's see how to access the store's state from any component.
