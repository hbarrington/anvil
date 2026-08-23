import React, { useCallback, useMemo } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { STATUS_VALUES, TODO_STATUS_OPTIONS } from '../../utils/constants'
import { Todo, sortTodos } from '../../utils/markdownUtils'

interface TodoSectionProps {
  todos?: Todo[]
  onChange: (todos: Todo[]) => void
}

function TodoSection({ todos, onChange }: TodoSectionProps): JSX.Element {
  const items = todos || []
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null)

  const counts = useMemo(() => ({
    [STATUS_VALUES.TODO.TO_DO]: items.filter(todo => (todo.status || STATUS_VALUES.TODO.TO_DO) === STATUS_VALUES.TODO.TO_DO).length,
    [STATUS_VALUES.TODO.IN_PROGRESS]: items.filter(todo => todo.status === STATUS_VALUES.TODO.IN_PROGRESS).length,
    [STATUS_VALUES.TODO.DONE]: items.filter(todo => todo.status === STATUS_VALUES.TODO.DONE).length
  }), [items])

  const handleFieldChange = useCallback((index: number, field: keyof Todo, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    onChange(newItems)
  }, [items, onChange])

  const handleOrderChange = useCallback((index: number, value: string) => {
    const parsed = parseInt(value, 10)
    const newItems = [...items]
    newItems[index] = { ...newItems[index], order: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 }
    onChange(newItems)
  }, [items, onChange])

  // Re-sort by Order so the editor matches what the document and explorer show.
  // The numbers themselves are left exactly as entered - any starting point and any
  // gaps in the sequence are the author's choice.
  const handleApplyOrder = useCallback(() => {
    onChange(sortTodos(items))
  }, [items, onChange])

  const handleAdd = useCallback(() => {
    const nextOrder = items.reduce((max, todo) => Math.max(max, Number(todo.order) || 0), 0) + 1
    onChange([...items, { order: nextOrder, name: '', description: '', status: STATUS_VALUES.TODO.TO_DO }])
  }, [items, onChange])

  const handleRemove = useCallback((index: number) => {
    const newItems = [...items]
    newItems.splice(index, 1)
    onChange(newItems)
  }, [items, onChange])

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null)
      return
    }

    // Keep whatever numbering scheme the author is using: the existing order values stay
    // with their positions, and the to dos move between them
    const orders = items.map((todo, index) => (Number(todo.order) > 0 ? Number(todo.order) : index + 1))

    const newItems = [...items]
    const [removed] = newItems.splice(draggedIndex, 1)
    newItems.splice(targetIndex, 0, removed)

    onChange(newItems.map((todo, index) => ({ ...todo, order: orders[index] })))
    setDraggedIndex(null)
  }, [draggedIndex, items, onChange])

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
  }, [])

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-foreground">To Do</h4>
        {items.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 rounded-full bg-muted">{counts[STATUS_VALUES.TODO.TO_DO]} To Do</span>
            <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600">{counts[STATUS_VALUES.TODO.IN_PROGRESS]} In Progress</span>
            <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-600">{counts[STATUS_VALUES.TODO.DONE]} Done</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 text-sm font-medium text-foreground w-8"></th>
              <th className="text-left p-2 text-sm font-medium text-foreground w-20">Order</th>
              <th className="text-left p-2 text-sm font-medium text-foreground w-1/4">Name</th>
              <th className="text-left p-2 text-sm font-medium text-foreground">Description</th>
              <th className="text-left p-2 text-sm font-medium text-foreground w-40">Status</th>
              <th className="text-left p-2 text-sm font-medium text-foreground w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((todo, index) => (
              <tr
                key={index}
                className="border-b border-border hover:bg-accent"
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                <td className="p-2 cursor-move">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min={1}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={todo.order || index + 1}
                    onChange={(e) => handleOrderChange(index, e.target.value)}
                    onBlur={handleApplyOrder}
                    title="Sort order - the lowest number sits at the top"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="text"
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={todo.name || ''}
                    onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                    placeholder="To do name"
                  />
                </td>
                <td className="p-2">
                  <textarea
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[38px]"
                    value={todo.description || ''}
                    onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                    placeholder="What needs to be done?"
                    rows={1}
                  />
                </td>
                <td className="p-2">
                  <select
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={todo.status || STATUS_VALUES.TODO.TO_DO}
                    onChange={(e) => handleFieldChange(index, 'status', e.target.value)}
                  >
                    {TODO_STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="p-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
                    title="Remove to do"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-sm text-muted-foreground text-center">
                  No to dos yet. Add one to start tracking work for this document.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Add To Do
        </button>
      </div>
    </div>
  )
}

export default React.memo(TodoSection)
