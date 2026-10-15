---
sidebar_position: 9
---

# Server-side rendering

Normally, the browser gets an almost empty page and a script, and React builds the page in the
browser. With **server-side rendering** (SSR), the server runs your components and sends the
finished HTML. The browser shows it right away. Then React starts in the browser and
**hydrates** the page: it renders the same components again, and connects them to the HTML that
is already there. From then on, it's a normal React app.

Hydration has one rule: the first render in the browser must produce exactly the same HTML the
server produced. If it doesn't, React logs a "hydration mismatch" and redraws the page.

Kiss works with SSR, on React 18 and 19, with Next.js or without a framework. This page shows
how. If you use Next.js, read the first two sections and you are done. The rest explains what
happens underneath, and covers plain Node.

## Next.js app router

Three things to write: a provider, your pages, and your mutations.

### 1. The provider

Create the store in a client component, once, and give it the state the server loaded:

```tsx
// src/KissProvider.tsx
'use client';
import { StoreProvider } from 'kiss-for-react';
import { useState, type ReactNode } from 'react';

export function KissProvider({ initialState, children }: { initialState: State; children: ReactNode }) {
  const [store] = useState(() => createStore<State>({ initialState }));
  return (
    <StoreProvider store={store} serverState={initialState}>
      {children}
    </StoreProvider>
  );
}
```

Render it in the root layout, which is a server component. The layout loads the initial state
on the server, and passes it to the provider as a prop:

```tsx
// app/layout.tsx
export default async function RootLayout({ children }: { children: ReactNode }) {
  const initialState = await loadInitialState();
  return (
    <html><body>
      <KissProvider initialState={initialState}>{children}</KissProvider>
    </body></html>
  );
}
```

Since the layout stays mounted when the user moves between pages, the store is created once,
and keeps its state across navigation.

Two details:

- The `serverState` prop tells Kiss what the server HTML shows. While hydrating, the hooks
  render that, even if the store already changed (for example, a persistor restored a newer
  state from `localStorage`). This is what prevents hydration mismatches. After hydration,
  the hooks follow the store.
- If you use a persistor that reads `localStorage`, create it only in the browser:
  `persistor: typeof window === 'undefined' ? undefined : new MyPersistor()`. On the server
  there is no `localStorage`.

Your `loadInitialState` can use Kiss too. Create a store, dispatch the action that loads the
data, wait for it, take the state, and dispose the store:

```ts
// src/server-state.ts
export async function loadInitialState(): Promise<State> {
  const store = createStore<State>({ initialState: emptyState });
  try {
    await store.dispatchAndWait(new LoadData());
    return store.state;
  } finally {
    await store.dispose();
  }
}
```

In server components, `kiss-for-react` gives you the store and the actions, but not the hooks.
Hooks only work in client components (the ones with `'use client'` at the top). If you import
a hook in a server component, you get a build error, which is the right thing.

### 2. The pages

Each page loads its own data on the server. Give that data to the store with `StoreSlice`:

```tsx
// app/users/[id]/page.tsx (a server component)
import { StoreSlice } from 'kiss-for-react';

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await fetchUser((await params).id);
  return (
    <StoreSlice state={{ user }} key={`${user.id}:${user.updatedAt}`}>
      <UserView />
    </StoreSlice>
  );
}
```

`StoreSlice` takes a piece of state, and merges it into the store. It does that on the server,
so the HTML shows the user. It does that in the browser too, before the page renders, so
hydration matches, and when the user navigates to this page, the page shows the user in its
very first render. No empty frame, no old user flashing before the new one.

The components inside `StoreSlice` are normal client components, using the hooks:

```tsx
// src/UserView.tsx
'use client';
export function UserView() {
  const user = useSelect((state: State) => state.user);
  return <h1>{user?.name}</h1>;
}
```

Rules for `StoreSlice`:

- **Give it a `key` that changes when the data changes.** The slice is merged when the
  component mounts, and not again. A new key mounts it again. Use the entity's id plus its
  `updatedAt`, as above, so that a page that reloads with fresh data (after a server action,
  for example) merges the fresh data.
- **The slice is a plain object**, like `{ user }`. It travels from the server component to
  the browser as a prop, so it must be serializable. It's merged with a shallow merge:
  `{ ...state, ...slice }`. The server data wins: if the slice has `user`, it replaces the
  `user` in the store. The rest of the state is kept.
- **If your state is a class**, not a plain object, tell Kiss how to merge, in `createStore`:

  ```ts
  createStore<State>({
    initialState,
    mergeServerState: (state, slice: { user?: UserJson }) =>
      slice.user ? state.withUser(User.fromJson(slice.user)) : state,
  });
  ```

  This is also where you turn the plain JSON of the slice back into your classes.
- A page with a `loading.tsx` streams: the browser gets the layout first, and the page a moment
  later. `StoreSlice` works the same.
- The merge is an action, called `MergeServerStateAction`. You see it in the logs like any
  other action. You can also do it yourself, with `store.mergeServerState(slice)`.

### 3. The mutations

Mutations are normal Kiss actions. To change data on the server, the action calls a **server
action**:

```ts
// app/users/actions.ts (runs on the server)
'use server';
export async function renameUser(id: number, name: string) {
  if (name === '') return { ok: false, error: 'The name cannot be empty.' };
  const user = await db.renameUser(id, name);
  revalidatePath(`/users/${id}`);
  return { ok: true, user };
}

// src/actions.ts (runs in the browser)
export class RenameUser extends Action {
  constructor(readonly id: number, readonly name: string) { super(); }

  async reduce() {
    const result = await renameUser(this.id, this.name);
    if (!result.ok) throw new UserException(result.error);
    return (state: State) => ({ ...state, user: result.user });
  }
}
```

This gives you `useIsWaiting`, `useIsFailed`, retries and optimistic updates on top of server
actions, with no `fetch` code. Two things to know:

- Return failures as values, like `{ ok: false, error }`, and let the Kiss action throw the
  `UserException`. Next.js hides the message of an error thrown by a server action in
  production.
- `revalidatePath` makes Next.js render the page again with the fresh data. Since the user's
  `updatedAt` changed, the `StoreSlice` key changes, and the fresh data is merged.

That's all for the app router. The
[app router example](https://github.com/marcglasberg/kiss-for-react/tree/main/examples/nextjs-app-router)
has all of this working, with tests.

## Next.js pages router

The pages router has no server components. The same three things, in their pages-router form.

### 1. The provider

Create the store in `_app.tsx`, once, from the props of the first page:

```tsx
// pages/_app.tsx
export default function App({ Component, pageProps }: AppProps<{ initialState: State }>) {
  const [serverState] = useState(() => pageProps.initialState);
  const [store] = useState(() => createStore<State>({ initialState: serverState }));
  return (
    <StoreProvider store={store} serverState={serverState}>
      <Component {...pageProps} />
    </StoreProvider>
  );
}
```

Both are kept in `useState` on purpose. When the user navigates, `_app` gets the props of the
new page, but the store must not be created again, and `serverState` must stay what the server
HTML showed when the app loaded.

### 2. The pages

Every page's `getServerSideProps` returns two things: `initialState`, which `_app` uses when
this is the first page loaded, and the page's own `slice`:

```tsx
// pages/users/[id].tsx
export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const user = await fetchUser(params.id);
  return { props: { initialState: await loadInitialState(), slice: { user } } };
};

export default function UserPage({ slice }: { slice: { user: User } }) {
  return (
    <StoreSlice state={slice} key={`${slice.user.id}:${slice.user.updatedAt}`}>
      <UserView />
    </StoreSlice>
  );
}
```

`StoreSlice` works exactly as in the app router, with the same rules. The key matters here
too: when the user goes from `/users/3` to `/users/2`, the page component stays mounted, and
the new key is what merges the new user.

### 3. The mutations

There are no server actions. The Kiss action calls an API route with `fetch`, and the rest is
the same. The
[pages router example](https://github.com/marcglasberg/kiss-for-react/tree/main/examples/nextjs-pages-router)
has all of this working, with tests.

## What happens underneath

You don't need this to use Kiss with Next.js. It explains the rules above, and it's what you
need if you do SSR without a framework.

### Every hook has a server value

On the server, and while hydrating, the hooks don't read the live store. They read the
`serverState` of the provider (or the `initialState` of the store, if you gave no
`serverState`). The status hooks have fixed values: `useIsWaiting` and `useIsFailed` are
`false`, `useExceptionFor` is `null`, and `useIsStoreReady` is `true`. So the HTML never shows
a spinner, an error, or a store that is still loading. After hydration, all the hooks follow
the live store.

This means the server must load the data **before** rendering. Dispatching during the render
does nothing useful: the server renders once, and `useStoreEffect` doesn't run there.

### One store per request

Never create the store at the top of a module on the server. All the requests the server
handles would share it, and users would see each other's data. Create the store inside the
request, and dispose it when the request is done:

```tsx
app.get('/', async (req, res) => {
  const store = createStore<State>({ initialState: new State() });
  try {
    await store.dispatchAndWait(new LoadData(req.params));
    const html = renderToString(
      <StoreProvider store={store} serverState={store.state}>
        <App />
      </StoreProvider>
    );
    res.send(page(html, JSON.stringify(store.state)));
  } finally {
    await store.dispose();
  }
});
```

`store.dispose()` stops everything the store could leave running: polling, debounce and retry
timers, pending `dispatchWhen`s, and pending waits like `waitCondition` (they reject). A
disposed store leaves nothing behind in the Node process. In the browser, the usual single
store is fine.

### The state travels as JSON

The server puts the state in the HTML, usually in a `<script type="application/json">` tag,
and the browser reads it and creates its store with it. Write `<` as `\u003c` inside that
script, so that the state can't close the tag. In Next.js, the state is a prop, and Next.js
does this for you.

A plain-object state goes through `JSON.stringify`. If your state has class instances, `Map`s,
`Set`s or `Date`s, write your own `toJSON`/`fromJSON`, or use the serializer you already use
for persistence (see the [Persistor](./persistor.md) page). The browser must rebuild the same
state the server rendered, with the same classes, or the hooks and the HTML won't agree.

Also, don't render anything that is different on the server and in the browser, like a date
formatted in the local time zone. Keep it as a string in the state, and format it after
hydration.

### Hydration in the browser

Create the store with the state from the HTML, pass it as `serverState`, and hydrate:

```tsx
const state = JSON.parse(document.getElementById('state')!.textContent!);
const store = createStore<State>({ initialState: state, persistor: new LocalPersistor() });
hydrateRoot(
  document.getElementById('root')!,
  <StoreProvider store={store} serverState={state}>
    <App />
  </StoreProvider>
);
```

Why `serverState`, if the store already has that state? Because the store may change before
React hydrates. A persistor can restore a newer state from `localStorage` first. Without
`serverState`, React would render the newer state, see that it doesn't match the HTML, and
redraw the page. With it, hydration matches, and then the page updates to the newer state.

### Streaming

`renderToPipeableStream` (Node) and `renderToReadableStream` (edge runtimes) send the page in
pieces: first everything outside the `Suspense` boundaries, then each boundary when it's
ready. The hooks inside the boundaries read `serverState` too, so the complete page hydrates
without mismatches. Dispose the store when the stream ends (in `onAllReady`, and when the
connection closes).

## Examples

Three complete examples, each with a persistor in the browser, and with Playwright tests that
check the server HTML with JavaScript disabled, then the hydration (no warnings in the
console), the actions, the navigation between pages, and the state restored by the persistor:

* [Next.js app router](https://github.com/marcglasberg/kiss-for-react/tree/main/examples/nextjs-app-router):
  the provider in the root layout, pages with `StoreSlice`, a server action, and a streamed page.
* [Next.js pages router](https://github.com/marcglasberg/kiss-for-react/tree/main/examples/nextjs-pages-router):
  `getServerSideProps`, the store in `_app.tsx`, pages with `StoreSlice`, and an API route.
* [Express, with streaming](https://github.com/marcglasberg/kiss-for-react/tree/main/examples/ssr-express):
  no framework. `renderToPipeableStream` on the server, `hydrateRoot` in the browser.

In all of them, the items come from the server on every request, the click count is kept in
`localStorage` and survives a reload, and the pages hydrate with no mismatch even when the
persistor restored the clicks before React started.

There is also the
[todo app with Next.js](https://github.com/marcglasberg/kiss-for-react/tree/main/examples/todo-app-nextjs):
the [Vite todo app](https://github.com/marcglasberg/kiss-for-react/tree/main/examples/todo-app-example)
ported to the app router. The todos live on the server, in a JSON file that stands in for a
database and survives restarts: the page opens with them already rendered, and every change
(add, toggle, remove) is a Kiss action that calls a server action. The filter is client state,
kept by the `ClassPersistor` in `localStorage`: after a reload, the filter is restored while the
server's todos are merged on top of it. The state is made of classes (`State`, `TodoList`,
`TodoItem`), so it shows what a class-based state needs with SSR: the todos travel as plain
JSON and are rebuilt into classes by the `mergeServerState` option, and the classes declare
`static typeName`, because Next.js minifies class names in production and the `ClassPersistor`
saves the state by class name.

## Which state belongs in the store?

- In an **interactive app** (a dashboard, a SaaS, a tool), Next.js renders the first page, and
  then the app lives in the browser. Put the data the app works with in the store: load it per
  page with `StoreSlice`, change it with actions, persist it if you want. Kiss replaces both a
  client-state library and a server-state library here.
- In a **content site** that leans on server components, caching and streaming, keep the data
  in the server components, and use the store for client state only. Kiss works the same way
  there, just with less in the store.
