---
sidebar_position: 6
---

# Business logic

Where should you put your business logic in your application architecture?

### ✓ State classes

State classes form the core of your business logic. For example, in a _Todo List_
application you can have a `TodoList` class that manages the list of todos,
and a `Todo` class that manages a single todo.
The recommendation is to implement the majority of your business logic within state classes.

### ✗ Actions and reducers

Actions and Reducers are also classified as business code.
But you should use them primarily only to invoke business logic from your state classes.

### ✗ React components

React Components are strictly client-side code.
Avoid implementing business logic in components.

### ✗ Custom react hooks

You should avoid creating and using custom hooks, when using Kiss,
as they are mostly not necessary. However, if you do use custom hooks,
avoid incorporating business logic in them.

## Example

To better understand this architecture, let's review the _Todo List_ application
created in the [Tutorial](../tutorial/full-code) section, and find
where is the code that implements **toggling a todo item as active or completed**.

Here is the code of the todo item **component**:

```tsx
function TodoItemComponent({ item }: { item: TodoItem }) {

  const store = useStore();
  const filter = useSelect((state: State) => state.filter);

  return item.ifShows(filter) ? (
    <label>
      <input
        type="checkbox"
        checked={item.completed}
        onChange={() => store.dispatch(new ToggleTodoAction(item))}
      />
      <div>{item.text}</div>
    </label>
  ) : (
    <span />
  );
}
```

As you can see above, the component code does not contain any code to toggle a todo item. 
Instead, it dispatches an action called `ToggleTodoAction`.
So let's see the code of this **action** and its **reducer**:

```tsx
class ToggleTodoAction extends Action {
  constructor(readonly item: TodoItem) { super(); }

  reduce() {
    let newTodoList = this.state.todoList.toggleTodo(this.item);
    return this.state.withTodoList(newTodoList);
  }
}
```

Again, as you can see above, the action also does not contain any code to toggle a todo item.
Instead, it calls the `toggleTodo()` function of the `todoList` object present in the **state**.
So let's see the code of this function in the `TodoList` class:

```tsx
export class TodoList {
  constructor(public readonly items: TodoItem[] = []) {}  

  toggleTodo(item: TodoItem): TodoList {
    const newTodos = this.items.map((itemInList) =>
      itemInList === item ? item.toggleCompleted() : itemInList
    );
    return new TodoList(newTodos);
  }

  ...
}
```

The `toggleTodo()` function iterates over the todo items, and toggles the one that matches
the item we want. To toggle it, it calls the `toggleCompleted()` function of the `TodoItem` class.

Finally, here is the code that actually toggles the todo item:

```tsx
export class TodoItem {
  constructor(public text: string, public completed: boolean = false) {}

  toggleCompleted() {
    return new TodoItem(this.text, !this.completed);
  }

  ...
}
```

As you can see, the business logic is in the state classes `TodoList` and `TodoItem`.
The component only dispatches the action, and the action only calls the state classes.
This also makes the business logic easy to test, since you can test the state classes directly.
