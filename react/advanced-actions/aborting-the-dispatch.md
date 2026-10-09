---
sidebar_position: 7
---

# Aborting the dispatch

You may override the action's `abortDispatch()` function to completely prevent
running the action under certain conditions.

:::warning

This is a complex power feature that you may not need to learn.
If you do, use it with caution.
:::

In more detail, if function `abortDispatch()` returns `true`,
the action will not be dispatched: `before`, `reduce` and `after` will not be called.

# Example

```ts
class UpdateUserInfo extends Action {

  // If there is no user, the action will not run.
  abortDispatch() {
    return this.state.user === null;
  }

...
```

## Creating a base action

You may modify your [base action](./base-action-with-common-logic) to make it easier
to add this behavior to multiple actions:

```ts
export abstract class Action extends KissAction<State> {

  allowWhenLoggedOut = false;   
  
  abortDispatch() {
  
    // The action should abort if it's not allowed to run while 
    // the user is logged out, and the user is indeed logged out. 
    let shouldAbort = !this.allowWhenLoggedOut && (this.state.user === null);        
    
    if (shouldAbort) {      
      navigateToHomePage();              
      return true; // Abort the action.      
    }        
    else {           
      return false; // Don't abort the action.
    } 
  }  
}
```

Now, only actions with `allowWhenLoggedOut = true` will be able to run
when the user is logged out.

```ts
// This action to log in the user should 
// be able to run when the user is logged out.
class LogIn extends Action {
  allowWhenLoggedOut = true;         
  async reduce() { ... }
}

// This action that allows the user to send a message 
// should NOT be able to run when there is no user.
class SendMessage extends Action {           
  async reduce() { ... }
}
```


# Aborting the reduce

While `abortDispatch()` decides if the action runs at all,
`abortReduce()` decides, at the very end, if the state returned by the reducer
should be applied or thrown away.

Kiss calls `abortReduce(newState)` right after `reduce()` finishes,
and before the new state is applied.
If it returns `true`, the new state is discarded, as if `reduce()` had returned `null`,
and the state stays as it was. If it returns `false` (the default), the new state is applied.

Some details:

* `abortReduce()` is only called if the reducer would actually change the state.
  It's not called if `reduce()` throws an error, returns `null`, or returns the same state.

* The `after()` method still runs, no matter what `abortReduce()` returns.

This is mostly useful for async actions. While the action is waiting,
for example for a server response, other actions may change the state.
When the action finally finishes, its result may be out of date.

For example, suppose the user logs out and a different user logs in
while the profile of the first user is still loading.
The loaded profile belongs to the wrong person, so we don't want to save it:

```ts
class LoadUserProfile extends Action {

  async reduce() {
    let profile = await api.getProfile(this.state.userId);
    return (state: State) => state.copy({ profile });
  }

  // If a different user logged in while we were loading, don't save this profile.
  abortReduce(newState: State) {
    return newState.userId !== this.initialState.userId;
  }
}
```

Note `this.initialState` is the state when the action was dispatched,
while `newState` is the state the reducer wants to apply.
