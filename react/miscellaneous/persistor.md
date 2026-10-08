---
sidebar_position: 4
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Persistor

The **persistor** allows you to save the store's state to the local device disk.

- In the **web**, it allows the user to reload the page,
  or close the browser and reopen it later, without losing the previous state.

- In **React Native**, it allows the user to kill the app and reopen it later,
  without losing the previous state.

## Setup

You must set up your persistor during the store creation:

```tsx          
const store = createStore<State>({  
  initialState: ...  
  persistor: persistor, // Here!
});        
```

Don't read the saved state yourself. Kiss reads it for you, once, when the store is created.
Reading takes some time, so the store starts with the `initialState`, and then the saved state
replaces it as soon as it's loaded.

## Waiting for the store to be ready

Your UI can use the `initialState` while the saved state loads.
For example, if some information is missing from the initial state,
the UI can show a loading indicator in its place.

However, **any state changes made before the saved state is loaded may be overwritten by it.**
For this reason, use `await store.ready()` to wait until the store has loaded the saved state,
and only then dispatch the actions that start your app:

```tsx
const store = createStore<State>({
  initialState: State.initialState,
  persistor: persistor,
});

await store.ready();
store.dispatch(new InitAppAction());
```

A few things to know about `store.ready()`:

* It never fails. If reading the saved state fails, the error is reported
  (see [Persistence errors](#persistence-errors)) and the store keeps the initial state.

* You can call it as many times as you want, from different places.
  It doesn't read the saved state again.

* If the store has no persistor, it's ready right away.

* In the future, other things the store needs to do at startup may also be waited for here.

Let's first see how to implement your own persistor,
and then let's see how to use the `ClassPersistor` that comes out of the box with Kiss.

## Implementation

All a persistor needs to do is to extend the abstract `Persistor` class.
This class is shown below, with its three functions that must be
implemented: `readState`, `deleteState` and `persistDifference`.
You may also override `saveInitialState`, `throttle` and `wrapError`.

Read the comments in the code below to understand what each function should do.

```tsx
export abstract class Persistor<St> {
 
  // Function `readState` should read/load the saved state from the 
  // persistence. It will be called only once per run, when the app  
  // starts, during the store creation.
  //
  // - If the state is not yet saved (first app run), `readState`  
  //   should return `null`.
  //  
  // - If the saved state is valid, `readState` should return the 
  //   saved state.
  //
  // - If the saved state is corrupted but can be fixed, `readState`   
  //   should save the fixed state and then return it.
  //
  // - If the saved state is corrupted and cannot be fixed, or some  
  //   other serious error occurs while reading the state, `readState`   
  //   should thrown an error, with an appropriate error message.
  //
  // Note: If an error is thrown by `readState`, Kiss will log  
  // it with `Store.log()`, and give it to the store's `errorObserver` 
  // (with a `null` action). The saved state is then deleted, and the
  // initial-state is saved instead.
  abstract readState(): Promise<St | null>;

  // Function `deleteState` should delete/remove the saved state from 
  // the persistence.    
  abstract deleteState(): Promise<void>;

  // Function `persistDifference` should save the new state to the 
  // persistence, and return a `Promise` that completes only after 
  // it is persisted.
  //
  // This new state is provided to the function as a parameter 
  // called `newState`. For simpler apps where your state is small, 
  // you can simply persist the whole `newState` every time. 
  //
  // But for larger apps, you may compare it with the last persisted state, 
  // and persist only the difference between them. The last persisted state 
  // is provided to the function as a parameter called `lastPersistedState`. 
  // It may be `null` if there is no persisted state yet (first app run).  
  //
  // If this function throws an error, the `newState` is NOT considered 
  // persisted. See "Persistence errors" below.
  abstract persistDifference(
    lastPersistedState: St | null,
    newState: St
  ): Promise<void>;

  // Function `saveInitialState` should save the given `state` to the 
  // persistence, replacing any previous state that was saved.  
  // By default, it calls `persistDifference(null, state)`.
  saveInitialState(state: St): Promise<void> {
    return this.persistDifference(null, state);
  }

  // The default throttle is 2 seconds (2000 milliseconds). 
  // Return `null` to turn off the throttle.   
  get throttle(): number | null {
    return 2000; 
  }

  // Processes the errors thrown by `persistDifference`. 
  // Return the error, a different error, or `null` to ignore it.
  // See "Persistence errors" below.
  wrapError(error: any): any {
    return error;
  }

  // Reports an error without throwing it. See "Persistence errors" below.
  addError(error: any): void { ... }
}
```

Kiss will call these functions at the right time, so you don't need to worry about it:

* When the app opens, Kiss will call `readState()` to get the last state that was persisted.

* In case there is no persisted, state yet (first time the app is opened), the `saveInitialState()`
  function will be called to persist the initial state.

* In case there is a persisted state, but it's corrupted (reading the state fails with an error),
  then `deleteState()` will be called first to delete the corrupted state,
  and then `saveInitialState()` will be called to persist the initial state.

* In case the persisted state read with `readState()` is valid, this will become the current store
  state. At this point, `store.ready()` resolves (it also resolves in the other cases above,
  after the initial state is saved).

* From this moment on, every time the state changes, Kiss will schedule a call to
  the `persistDifference()` function. This function will not be called more than once each 2
  seconds, which is the default throttle interval. You can change it by overriding the `throttle`
  property (make it zero if you want no throttle, and the state will save as soon as it changes).

* In the unlikely case the `persistDifference()` function itself takes more than 2 seconds to
  execute, the next call will be scheduled only after the current one finishes.

* The `persistDifference()` function receives the last persisted state and the current new state.
  The simplest way to implement this function is to ignore the `lastPersistedState` parameter,
  and persist the whole `newState` every time. This is fine for small states, but for larger
  states you can compare the two states and persist only the difference between them.

* Even if you have a non-zero throttle period, sometimes you may want to save the state immediately,
  for some reason. You can do that by dispatching the built-in `PersistAction`
  with `dispatch(new PersistAction());`. This will ignore the throttle period and
  call `persistDifference()` right away to save the current state.

## Persistence errors

Saving the state may fail. For example, the disk may be full, or the storage may not be
available. Kiss never lets these errors crash your app. Instead:

* If `persistDifference()` throws an error, the state it was trying to save is **not**
  considered saved. Kiss doesn't retry the save by itself, but the next time the state changes,
  `persistDifference()` is called again with the newest state. Its `lastPersistedState`
  parameter will be the last state that was **really** saved, so persistors that save only the
  difference keep working.

* The error is first given to the persistor's `wrapError()` function, which you can override.
  You can return the error unchanged, return a different error, or return `null` to ignore it.
  For example, you can turn storage errors into a `UserException`, so that the user is told
  about them:

  ```ts
  wrapError(error: any) {
    return (error instanceof StorageError)
      ? new UserException('Could not save your data.', { hardCause: error })
      : error;
  }
  ```

* Then, if the error is a `UserException`, it's shown to the user, just like a
  `UserException` thrown by an action.

* Finally, the error is given to the store's
  [errorObserver](../advanced-actions/errors-thrown-by-actions#error-observer),
  with a `null` action. Since there is no `dispatch` call to throw the error to,
  returning `true` logs the error with `Store.log()`, and returning `false` ignores it.
  If you didn't define an `errorObserver`, errors that are not `UserException`s are logged
  with `Store.log()`.

Errors thrown by `readState()` when the app starts, and by the `deleteState()` and
`saveInitialState()` that follow it, also go to the `errorObserver` (they don't go through
`wrapError()`).

Sometimes your persistor can deal with a problem by itself, but you still want to let
the user know about it. In this case, don't throw. Instead, report the error with `addError()`.
For example, if the saved state is corrupted and you reset it:

```ts
async readState(): Promise<State | null> {
  try {
    return await this.read();
  } catch (error) {
    await this.deleteState();
    this.addError(new UserException('Could not read your data, so it was reset.'));
    return null;
  }
}
```

Errors added with `addError()` are treated like the errors above,
but they don't go through `wrapError()`.

## ClassPersistor

Kiss comes out of the box with the `ClassPersistor` that implements the `Persistor`
interface. It supports serializing ES6 classes out of the box,
and it will persist the whole state of your application.

To use it, you must provide these function:

* `loadSerialized`: a function that returns the serialized state.
* `saveSerialized`: a function that saves the serialized state.
* `deleteSerialized`: a function that deletes the serialized state.
* `classesToSerialize`: an array of all the _custom_ classes that are part of your state.

In more detail, here's the `ClassPersistor` constructor signature:

```tsx
constructor(

  // Returns the serialized state.
  // It should return a Promise that resolves to the saved serialized 
  // state, or to null if the state is not yet persisted.
  public loadSerialized: () => Promise<string | null>,
    
  // Saves the given serialized state. 
  // It should return a Promise that resolves when the state is saved.    
  public saveSerialized: (serialized: string) => Promise<void>,
    
  // Deletes the serialized state. 
  // It should return a Promise that resolves when the state is deleted.
  public deleteSerialized: () => Promise<void>,
    
  // List here all the custom classes that are part of your state, directly 
  // or indirectly. Note: You don't need to list native JavaScript classes. 
  public classesToSerialize: Array<ClassOrEnum>
)
```

<br></br>

Here is the simplest possible persistor declaration that uses the `ClassPersistor`.
It uses `window.localStorage` for React web, and `AsyncStorage` for React Native:

<Tabs>
<TabItem value="rw" label="React">

```tsx 
let persistor = new ClassPersistor<State>(

  // loadSerialized
  async () => window.localStorage.getItem('state'),
  
  // saveSerialized
  async (serialized: string) => window.localStorage.setItem('state', serialized),
  
  // deleteSerialized
  async () => window.localStorage.clear(),
  
  // classesToSerialize
  []
);
```

</TabItem>
<TabItem value="rn" label="React Native">

```tsx
let persistor = new ClassPersistor<State>(

  // loadSerialized
  async () => await AsyncStorage.getItem('state'),
  
  // saveSerialized
  async (serialized) => await AsyncStorage.setItem('state', serialized),
  
  // deleteSerialized
  async () => await AsyncStorage.clear(),
  
  // classesToSerialize
  [] 
);
```

</TabItem>
</Tabs>

As explained, the `ClassPersistor` supports serializing ES6 classes.
However, you will need to list all class types in the `classesToSerialize` parameter above.

For example, consider the _Todo List_ app shown below,
which was created in our [tutorial](../category/tutorial).
It uses classes called `State`, `TodoList`, `TodoItem`, and `Filter` in its state.
This means that you must list them all in the `classesToSerialize` parameter of
the `ClassPersistor`:

```tsx
// classesToSerialize
[State, TodoList, TodoItem, Filter]
```

To see the persistence in action,
try adding some items to the todo list below, and then reload the page.
You should see those items surviving the reload.

<iframe
src="https://codesandbox.io/embed/sw3g2t?view=preview&module=%2Fsrc%2FApp.tsx&hidenavigation=1&fontsize=12.5&editorsize=50&previewwindow=browser&hidedevtools=1&hidenavigation=1"
style={{ width:'100%', height: '500px', borderRight:'1px solid black' }}
title="counter-async-redux-example"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
/>

### Class names and minification

The `ClassPersistor` saves each object together with the name of its class,
and uses that name to recreate the object when the state is read back.

However, production builds usually **minify** class names.
For example, `TodoItem` may become `e`.
If that happens, different classes may end up with the same name,
and the names may change from one version of your app to the next,
so the saved state can't be read back correctly.

To protect you, the `ClassPersistor` checks this when it's created.
If class names are being minified, and some class in `classesToSerialize`
has no `typeName` (see below), it throws a `StoreException`.
It also throws if two different classes would be saved under the same name.
Note this can only happen in production builds, since development builds are not minified,
so make sure to test a production build of your app before releasing it.

There are two ways to fix this. You can use either one, or both.

**Option 1: Give your state classes a `typeName`**

Add a static `typeName` to each class in `classesToSerialize`.
When present, it's used instead of the class name, and it's not affected by minification:

```tsx
class TodoItem {
  static readonly typeName = 'TodoItem';
  ...
}
```

This works with any bundler, and also lets you rename a class later
without breaking the state saved by older versions of your app:
just keep the same `typeName`.

Note a `typeName` is **not inherited**. If a class extends another class,
it must declare its own `typeName`.

**Option 2: Turn off class name minification**

Tell your bundler's minifier to keep class names. The rest of your code is still minified.
For example:

<Tabs>
<TabItem value="webpack" label="Webpack (Terser)">

```js
// webpack.config.js
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  optimization: {
    minimizer: [new TerserPlugin({ terserOptions: { keep_classnames: true } })],
  },
};
```

</TabItem>
<TabItem value="vite" label="Vite 8+">

```js
// vite.config.js
export default {
  build: {
    rolldownOptions: {
      output: { minify: { mangle: { keepNames: true } } },
    },
  },
};
```

</TabItem>
<TabItem value="vite7" label="Vite 7 and older">

```js
// vite.config.js
export default {
  esbuild: { keepNames: true },
};
```

</TabItem>
<TabItem value="metro" label="React Native (Metro)">

```js
// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const defaultConfig = getDefaultConfig(__dirname);

module.exports = mergeConfig(defaultConfig, {
  transformer: {
    minifierConfig: {
      ...defaultConfig.transformer.minifierConfig,
      keep_classnames: true,
      // Needed because React Native's Babel preset turns classes into functions.
      keep_fnames: true,
    },
  },
});
```

</TabItem>
</Tabs>

The exact option depends on your bundler and its version,
so check its documentation if the above doesn't apply to you.

**Next.js** has no setting to keep only class names, so we recommend option 1.
The only way to keep them is `next build --no-mangling`, which turns off the minification
of **all** names, not only class names, and makes your JavaScript considerably larger.

## App lifecycle

In mobile apps, you have to understand the app lifecycle to use the persistor correctly:

* Foreground: The app is active and running, and is visible to the user.
* Background: The app is running but is not visible to the user, usually because the user has
  switched to another app or returned to the home screen.
* Inactive: The app is transitioning between states, such as when an incoming call occurs, but the
  user has not yet decided whether to accept or reject the call.
* Terminated: The app was killed, and is not running. It can be explicitly terminated by the user
  or the system.

When the app goes to the **background**, you may want to call `store.pausePersistor()`
to **pause** the persistor, and then **resume** it by calling `store.resumePersistor()`
when the app comes back to the **foreground** .

However, when the app is **terminated**, it's a different story.
In this case, you must force the persistor to save the state immediately.
This is necessary because a throttle of a few seconds was probably defined for the persistor.
For example, suppose the throttle is 2 seconds (the default),
but the app is killed 1 second after the last save.

In this case, all state changes for the last second will be lost.
To avoid this, as soon as you detect that the app is about to be killed,
you should call `store.persistAndPausePersistor()` to save the state immediately,
and then pause the persistor.

## Log out

When your user logs out of your app, or deletes its user account,
you want to go back to the login page, and allow another user to log in,
or start a new sign-up process.

To that end, you need to delete the persisted state, and return the store
state to its initial-state.

You may be temped to write `dispatch(new UpdateStateAction((state: State) => initialState));`
but that's not so simple. The persistor may be waiting for the throttle period, some async
actions may still be running, etc. Thankfully, Kiss provides you with a `store.logOut()`
function that you can call to perform this process safely.

This is how you can do it:

```ts
await store.logOut({
  initialState: State.initialState,
  throttle: 3000,
  actionsThrottle: 6000,
});
```  

When this function returns, your initial store state will be restored to its initial state.

Defining `throttle` and `actionsThrottle` above is optional, because
the default `throttle` is 3 seconds, and the default `actionsThrottle` is 6 seconds.
This is how `logOut()` uses them:

- Waits for `throttle` milliseconds to make sure all async processes that the app may
  have started have time to finish.

- Waits for all actions currently running to finish, but wait at most `actionsThrottle`
  milliseconds. If the actions are not finished by then, the state will be deleted anyway.

:::warning

If you know about any timers or async processes that you may have started, you should stop/cancel
them all **before** calling the `logOut()` function.

Also, it's up to you to redirect the user to the login page after `logOut()` returns.

:::

## Manually accessing the persistor

The functions below are probably only useful for **testing** the persistence of your app.
Only use them in production if you know exactly what you're doing,
and you have a very good reason to do so.

As explained above, when you create the persistor you add it to the store:

```tsx          
const store = createStore<State>({  
  initialState: ...  
  persistor: persistor, 
});        
```

After this, you should **not** keep a reference to the persistor,
and should not call any of the persistor functions.

Since Kiss is managing the persistor, calling the persistor functions directly
may disrupt the delicate process of keeping track of state changes.

However, you can still use the persistor **indirectly** through the store:

* `saveInitialStateInPersistence(initialState)` asks the Persistor to save the
  given `initialState` to the local device disk.

* `readStateFromPersistence` asks the Persistor to read the state from the local device disk.
  If you use this function, you **must** yourself put this state into the store.
  Kiss will assume that's the case, and will not work properly otherwise.

* `deleteStateFromPersistence()` asks the Persistor to delete the saved state from the local
  device disk.

* `getLastPersistedStateFromPersistor()` gets the last state that was saved by the Persistor.

