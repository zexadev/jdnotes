declare module 'markdown-it-task-lists' {
  interface TaskListsOptions {
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }
  const plugin: (md: import('markdown-it').default, options?: TaskListsOptions) => void
  export default plugin
}
