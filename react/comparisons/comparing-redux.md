---
sidebar_position: 1
---

# Comparing with Redux Toolkit

This page is for people who know Redux Toolkit. It shows how to get the same results with
Kiss, with less code. Each section shows the Redux Toolkit code first, and then the Kiss code
that does the same.

Kiss and Redux want the same things:

* The app should be predictable.
* The app should behave the same way every time.
* The state and the logic should be in one place.
* It should be easy to see what happened, and to debug it.

Redux Toolkit was created to make Redux easier to write. It helps, but a lot of wiring is
still there: slices, action creators, string action types, thunks, middleware, and extra
reducers for every step of an async process. Kiss keeps the ideas of Redux and drops the
wiring. An action is a class. Its reducer is a method of that class. That's all.

## Quick translation

If you know Redux Toolkit, this table tells you where to look in Kiss. The sections below
explain each line, with code.

| Redux Toolkit                                                 | Kiss                                                                    |
|---------------------------------------------------------------|-------------------------------------------------------------------------|
| `configureStore({ reducer: { ... } })`                        | `createStore({ initialState })`. Nothing to wire.                       |
| A slice (`createSlice`)                                       | A field in your `State` class, and the actions that change it           |
| An action creator, its string type, and its case reducer      | One action class, with a `reduce()` method                              |
| `dispatch(increment(5))`                                      | `dispatch(new Increment(5))`                                            |
| Immer "mutations" inside a reducer                            | `state.copy({ ... })`, which returns a new state                        |
| `createAsyncThunk`                                            | An action with `async reduce()`                                         |
| `extraReducers` for `pending`, `fulfilled`, `rejected`        | Not needed. The reducer returns the new state. Errors are thrown.       |
| `status: 'loading'` and `error` fields in the state           | `useIsWaiting(Action)`, `useIsFailed(Action)`, `useExceptionFor(Action)` |
| Thunk `extraArgument`                                         | `dependencies` in `createStore`, read with `this.deps` in the action    |
| `useSelector`                                                 | `useSelect` (also written `useSelector`), `useObject`, `useAllState`    |
| `useDispatch`                                                 | `useDispatch`                                                           |
| Logger middleware, devtools                                   | `actionObserver` and `stateObserver` in `createStore`                   |
| `serializableCheck`, `immutableCheck` middleware              | Not needed. See [Other middleware](#other-middleware).                  |
| RTK Query (loading state, deduplication, optimistic updates)  | [Action features](../advanced-actions/action-features)                  |
| `redux-persist`                                               | The [persistor](../miscellaneous/persistor)                             |
| Testing a thunk through a mock store, or through the UI       | `store.dispatchAndWait(action)`, then check `store.state`               |

## Creating the store

With Redux Toolkit, the store must know every reducer in advance. You import them all,
put them in a map, and pass the map to `configureStore`. If you need thunks with an extra
argument, a logger, or a check turned off, that goes in the `middleware` function:

```ts title="Redux Toolkit"
import todosReducer from './todos/todosSlice';
import userReducer from './user/userSlice';

const store = configureStore({
  reducer: {
    todos: todosReducer,
    user: userReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: { extraArgument: api },
      serializableCheck: false,
    }).concat(logger),
});
```

Every time you add a slice, you come back here and add a line.

With Kiss, the store only needs the initial state. It doesn't need to know the actions in
advance, because each action carries its own reducer. The things you may want to add, like
dependencies and a logger, are plain options:

```ts title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  dependencies: () => api,                    // Optional. See "Dependencies" below.
  actionObserver: (action) => log(action),    // Optional. See "Logging" below.
});
```

You never come back here to add an action.

## State and slices

With Redux Toolkit, the state is split into slices. Each slice has a name, an initial state,
and reducers. The reducers look like they mutate the state, but they don't: a library called
Immer records the changes and makes a new object. Each reducer also creates an action creator
with a string type, like `'todos/addTodo'`:

```ts title="Redux Toolkit"
interface TodosState {
  items: Todo[];
}

const initialState: TodosState = { items: [] };

const todosSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    addTodo(state, action: PayloadAction<Todo>) {
      state.items.push(action.payload); // Looks like a mutation. Immer makes a copy.
    },
    removeTodo(state, action: PayloadAction<string>) {
      state.items = state.items.filter((todo) => todo.id !== action.payload);
    },
  },
});

export const { addTodo, removeTodo } = todosSlice.actions;
export default todosSlice.reducer;
```

With Kiss, the state is one class. All the fields of the app are declared there, so you can
read the whole shape of your app in one file. The `copy()` method returns a new state with
some fields changed. Nothing is ever mutated, and there is no Immer:

```ts title="Kiss"
class State {
  constructor(
    readonly todos: readonly Todo[],
    readonly user: User | null,
  ) {}

  copy(changes: Partial<State>): State {
    return Object.assign(new State(this.todos, this.user), changes);
  }

  static initialState = new State([], null);
}
```

The actions that change the todos are classes. Each one has its own reducer, which returns
the new state:

```ts title="Kiss"
class AddTodo extends Action {
  constructor(readonly todo: Todo) { super(); }
  reduce() { return this.state.copy({ todos: [...this.state.todos, this.todo] }); }
}

class RemoveTodo extends Action {
  constructor(readonly id: string) { super(); }
  reduce() { return this.state.copy({ todos: this.state.todos.filter((todo) => todo.id !== this.id) }); }
}
```

Kiss can also split the state into slices, if you want. The [Slices](../miscellaneous/slices)
page shows how, and explains why you probably won't need to.

## Actions and reducers

With Redux Toolkit, one action is three things in three places: a string type
(`'counter/increment'`), an action creator (`increment(5)`), and a case reducer that
handles it. You dispatch the result of calling the action creator. If you use
`createAction` and `createReducer` instead of a slice, the wiring is even more visible:

```ts title="Redux Toolkit"
const increment = createAction<number>('counter/increment');
const decrement = createAction<number>('counter/decrement');

const counterReducer = createReducer({ value: 0 }, (builder) => {
  builder
    .addCase(increment, (state, action) => { state.value += action.payload; })
    .addCase(decrement, (state, action) => { state.value -= action.payload; });
});

dispatch(increment(5));
```

With Kiss, an action is one class. The class name is the type. The constructor parameters
are the payload. The `reduce()` method is the reducer. You dispatch an instance of the
class:

```ts title="Kiss"
class Increment extends Action {
  constructor(readonly value: number) { super(); }
  reduce() { return this.state.copy({ counter: this.state.counter + this.value }); }
}

class Decrement extends Action {
  constructor(readonly value: number) { super(); }
  reduce() { return this.state.copy({ counter: this.state.counter - this.value }); }
}

dispatch(new Increment(5));
```

There is nothing to register. The moment you write the class, it works. And in your IDE,
you can click the action name where it's dispatched and land on its reducer, because they
are the same thing.

## Async processes

This is where the two differ the most.

Redux by itself knows nothing about async work. Redux Toolkit adds `createAsyncThunk` for
that. A thunk is a function that runs the async work and dispatches three actions on its
own: `pending` when it starts, `fulfilled` when it ends, and `rejected` when it fails. Your
slice must then handle those three actions in `extraReducers`, and keep a `status` field and
an `error` field in the state, so that the UI can show a spinner and an error message:

```ts title="Redux Toolkit"
// The thunk.
export const fetchUser = createAsyncThunk(
  'user/fetchUser',
  async (userId: string, { extra }) => {
    const api = extra as Api;
    return await api.fetchUser(userId);
  },
);

// The slice that handles the three actions the thunk dispatches.
interface UserState {
  user: User | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: UserState = { user: null, status: 'idle', error: null };

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Unknown error';
      });
  },
});

// The component.
function UserScreen({ userId }: { userId: string }) {
  const dispatch = useAppDispatch();
  const { user, status, error } = useAppSelector((state) => state.user);

  useEffect(() => { dispatch(fetchUser(userId)); }, [dispatch, userId]);

  if (status === 'loading') return <Spinner />;
  if (status === 'failed') return <p>{error}</p>;
  return <p>{user?.name}</p>;
}
```

That is a lot of code for "load a user". And the `status` and `error` fields are real state
that you must keep right. If you forget the `rejected` case, the spinner never goes away. If
one slice has one `status` field but three thunks, loading one thing shows a spinner on
another.

With Kiss, an action can be async. Its `reduce()` method awaits what it needs, and returns a
function that produces the new state. There is no pending, fulfilled, or rejected. If
something goes wrong, the action throws, and the state is not changed:

```ts title="Kiss"
class FetchUser extends Action {
  constructor(readonly userId: string) { super(); }

  async reduce() {
    const user = await this.deps.api.fetchUser(this.userId);
    return (state: State) => state.copy({ user });
  }
}

function UserScreen({ userId }: { userId: string }) {
  const user = useSelect((state: State) => state.user);
  const isWaiting = useIsWaiting(FetchUser);
  const isFailed = useIsFailed(FetchUser);
  const error = useExceptionFor(FetchUser);

  useStoreEffect({ onMount: (store) => store.dispatch(new FetchUser(userId)) });

  if (isWaiting) return <Spinner />;
  if (isFailed) return <p>{error?.message}</p>;
  return <p>{user?.name}</p>;
}
```

There are no `status` and `error` fields, because loading and failure are not state you
keep. They are questions you ask about the action: is `FetchUser` running? Did it fail? The
answers are always right, because Kiss tracks them for you. And any component can ask, not
only the one that dispatched the action. See
[Wait, fail, succeed](../basics/wait-fail-succeed).

To turn any error into a message for the user, override `wrapError()` in the action:

```ts title="Kiss"
class FetchUser extends Action {
  async reduce() { ... }

  wrapError(error: any) {
    return new UserException('Could not load the user.', { hardCause: error });
  }
}
```

## Dependencies

With Redux Toolkit, the way to give your thunks an API client, without importing it as a
global, is the thunk `extraArgument`. You set it in the middleware when you create the
store, and read it from the thunk's second parameter, with a cast:

```ts title="Redux Toolkit"
const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: { extraArgument: api } }),
});

const fetchUser = createAsyncThunk('user/fetchUser', async (userId: string, { extra }) => {
  const api = extra as Api;
  ...
});
```

With Kiss, you give the dependencies to the store, and a base action class gives you typed
access to them. Every action extends that base class:

```ts title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  dependencies: () => ({ api: new Api() }),
});

abstract class Action extends KissAction<State> {
  get deps(): Dependencies { return this.store.dependencies as Dependencies; }
}

class FetchUser extends Action {
  async reduce() {
    const user = await this.deps.api.fetchUser(this.userId);
    ...
  }
}
```

In a test, give the store fake dependencies instead. Nothing has to be mocked by module
name. See [Dependency injection](../miscellaneous/dependency-injection).

## Logging

With Redux Toolkit, to log every action you add a logger middleware. To see the state
changes, you use the Redux DevTools.

With Kiss, you pass two functions to the store. The `actionObserver` is called when an
action starts and when it ends. The `stateObserver` is called with the state before and
after each action:

```ts title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  actionObserver: (action, dispatchCount, ini) => console.log(ini ? 'Started' : 'Finished', action),
  stateObserver: (action, prevState, newState, error) => console.log(action, newState),
});
```

See [Log and metrics](../miscellaneous/log-and-metrics).

## Other middleware

Redux Toolkit turns on some middleware by default, to catch mistakes that Redux makes
possible:

* A check that the state can be serialized, and has no class instances.
* A check that no reducer mutated the state.
* A check that you didn't dispatch an action creator without calling it, as in
  `dispatch(increment)` instead of `dispatch(increment(5))`.

Kiss doesn't need any of them, because those mistakes can't happen:

* The [persistor](../miscellaneous/persistor) serializes class instances just fine, so the
  state can have classes.
* The state is built from immutable classes, as the [tutorial](../tutorial/creating-the-state)
  shows, so there is nothing to mutate.
* `dispatch` only accepts an action instance. Passing the class itself is a compile error.

## RTK Query

To show spinners, avoid duplicate requests, do optimistic updates, and decide for how long
data stays fresh, Redux Toolkit has a second library inside it,
[RTK Query](https://redux-toolkit.js.org/rtk-query/overview). It works like TanStack Query:
you define endpoints, and it keeps a cache next to your state.

With Kiss, spinners and error messages are the hooks shown above. The rest are
[action features](../advanced-actions/action-features) that you declare on the action:

```ts title="Kiss"
class FetchUser extends Action {
  fresh = 60000;          // Don't fetch again for 60 seconds. The data is still fresh.
  nonReentrant = true;    // If it's already running, don't start it again.
  retry = { on: true };   // If it fails, try again.
  checkInternet = true;   // If there is no internet, fail at once with a clear message.

  async reduce() { ... }
}
```

There is no second cache. The data goes in the state, where everything else is. For
optimistic updates, extend [OptimisticCommand](../advanced-actions/optimistic-features)
instead of writing the rollback by hand. The
[comparison with TanStack Query](./comparing-tanstack) goes through all of this in detail.

## Testing

With Redux Toolkit, testing a sync reducer is easy: call it with a state and an action. But
testing an async thunk is not. You either build a mock store with the thunk middleware and
check the list of dispatched actions, or you render the component and test through the UI.

With Kiss, you test async actions the same way as sync ones. Create a store, dispatch the
action, wait for it, and check the state:

```ts title="Kiss"
// Start with some IBM stocks.
const store = new Store<State>({
  initialState: new State({ portfolio: ['IBM'] }),
  dependencies: () => ({ api: new FakeApi() }),
});

// Buy Tesla stocks.
await store.dispatchAndWait(new BuyAction('TSLA'));

// Check we now have IBM and Tesla.
expect(store.state.portfolio).toEqual(['IBM', 'TSLA']);
```

No UI, no mock store, no list of actions to compare. Kiss also has many features to
[help you test](../category/testing), like waiting for a state condition, and recording all
actions and state changes.

## Why this matters

Less code is nice, but the real gain is where the decisions live:

* **One place for each thing.** The state is one class. An action is one class. The loading
  and error status come from the action. The dependencies come from the store. You never
  wonder where something goes.
* **Nothing to keep in sync.** There is no `status` field to forget, no action type string
  to mistype, no reducer to register.
* **Async is not special.** An async action is an action with `async` in front of its
  reducer. Everything else, the hooks, the tests, the logging, works the same.
* **Tests without UI.** All the business logic is in actions, so all of it can be tested by
  dispatching to a store.

---

Give it a try and [follow the tutorial](../tutorial/setting-up-the-store).
