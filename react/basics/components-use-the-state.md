---
sidebar_position: 3
---

# Components use the state

Once you [wrapped your app with a `StoreProvider`](./provide-the-store),
you can access the store's state from any component, by using one of three special hooks 
provided by Kiss.

## useAllState

The `useAllState` hook lets you access the state from any component.
The component will then re-render whenever the state changes:

```tsx
function MyComponent() { 
  const state = useAllState<State>();   
  
  return <div>{state.name} is {state.age} years old</div>;    
};
```

The problem with `useAllState` is that it re-renders the component 
every time anything in the state changes,
even if the component doesn't use the part of the state that changed.

## useSelect

The `useSelect` hook (which can also be written as `useSelector`)
selects only the part of the state that your component needs.

The component re-renders only when that part changes:

```tsx
function MyComponent() { 
  const name = useSelect((state: State) => state.name);   
  const age = useSelect((state: State) => state.age);
     
  return <div>{name} has {age} years old</div>;    
};
```

In other words, it is more efficient, but also a little more verbose to use.

## useObject

Finally, the `useObject` hook is another alternative that causes the component to re-render only when needed:

```tsx
function MyComponent() {
 
  const state = useObject((state: State) => ({
    name: state.name,
    age: state.age,
  }));
       
  return <div>{state.name} is {state.age} years old</div>;    
};
```

The component will now re-render only when the internal properties of the selected object change.

Note you can't do this with `useSelect`, because the selector creates a new object each time,
so `useSelect` would see a different value for every state change, and re-render the component
every time. Instead, `useObject` compares the new object with the previous one, value by value.
It also works with arrays: `useObject((state: State) => [state.name, state.age])`.
In other words, when at least one of `name` or `age` changes.

## Try it out

<iframe
src="https://codesandbox.io/embed/q2gjmw?view=split&module=%2Fsrc%2FApp.tsx&hidenavigation=1&fontsize=12.5&editorsize=70&previewwindow=browser&hidedevtools=1&hidenavigation=1"
style={{ width:'100%', height: '570px', borderRight:'1px solid black' }}
title="counter-async-redux-example"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
/>

<hr></hr>

Next, let's see how to define actions and reducers,
that allows us to change the store's state.
