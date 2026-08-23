import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { apiService } from '../services/apiService'
import { Todo as TodoItem, setTodoStatusInMarkdown, upsertTodosInMarkdown, parseTodosTable, sortTodos } from '../utils/markdownUtils'
import toast from 'react-hot-toast'
import { FileText, Plus, ArrowLeft, ChevronDown, ChevronRight, Settings, Box, Zap, PencilRuler, Ruler, Microscope, GripHorizontal, Filter, ListTodo } from 'lucide-react'

interface SidebarExpandedSections {
  capabilities: boolean
  enablers: boolean
  todos: boolean
}

interface ExpandedComponentGroups {
  [groupKey: string]: boolean
}

interface Todo {
  order: number
  name: string
  description: string
  status: string
}

interface Capability {
  id?: string
  title?: string
  name?: string
  path: string
  system?: string
  component?: string
  status?: string
  approval?: string
  todos?: Todo[]
}

interface Enabler {
  id?: string
  title?: string
  name?: string
  path: string
  capabilityId?: string
  status?: string
  approval?: string
  todos?: Todo[]
}

interface SelectedDocument {
  type: 'capability' | 'enabler'
  path: string
  id: string
}

interface Requirement {
  id: string
  name: string
  type: 'Functional' | 'Non-Functional'
  enablerID: string
  enablerName: string
}

export default function Sidebar(): JSX.Element {
  const {
    capabilities,
    enablers,
    selectedCapability,
    setSelectedCapability,
    selectedDocument,
    setSelectedDocument,
    navigationHistory,
    goBack,
    clearHistory,
    loading,
    searchTerm,
    searchResults,
    activeWorkspaceId,
    config,
    refreshData,
    suppressExternalChangeNotification
  } = useApp()

  const [expandedSections, setExpandedSections] = useState<SidebarExpandedSections>({
    capabilities: true,
    enablers: true,
    todos: true
  })

  const [expandedComponentGroups, setExpandedComponentGroups] = useState<ExpandedComponentGroups>({})

  // Track workspace changes to collapse navigation when switching workspaces
  const [previousWorkspaceId, setPreviousWorkspaceId] = useState<string | null>(null)

  // Enabler filtering toggle state
  const [filterEnablersByCapability, setFilterEnablersByCapability] = useState<boolean>(true)

  // To Do filtering toggle state - on shows the selection's to dos, off shows every to do
  const [filterTodosBySelection, setFilterTodosBySelection] = useState<boolean>(true)

  // Tracks the to do currently being saved from the explorer checkbox
  const [pendingTodo, setPendingTodo] = useState<string | null>(null)

  // Resizable sections state
  const [capabilitiesHeight, setCapabilitiesHeight] = useState<number>(50) // Percentage
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [todosHeight, setTodosHeight] = useState<number>(25) // Percentage of the whole sidebar
  const [isDraggingTodos, setIsDraggingTodos] = useState<boolean>(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const navigate = useNavigate()

  const toggleSection = (section: keyof SidebarExpandedSections): void => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const toggleComponentGroup = (groupKey: string): void => {
    setExpandedComponentGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }))
  }

  const handleCapabilityClick = (capability: Capability): void => {
    setSelectedCapability(capability)
    setSelectedDocument({
      type: 'capability',
      path: capability.path,
      id: capability.id || capability.title || capability.path
    })
    clearHistory()
    navigate(`/view/capability/${capability.path}`)
  }

  const handleEnablerClick = (enabler: Enabler): void => {
    setSelectedDocument({
      type: 'enabler',
      path: enabler.path,
      id: enabler.id || enabler.title || enabler.path
    })
    navigate(`/view/enabler/${enabler.path}`)
  }

  const handleRequirementClick = (requirement: Requirement): void => {
    // Find the enabler that contains this requirement
    const enabler = enablers.find(e => e.id === requirement.enablerID)
    if (enabler) {
      setSelectedDocument({
        type: 'enabler',
        path: enabler.path,
        id: enabler.id || enabler.title || enabler.path
      })
      navigate(`/view/enabler/${enabler.path}`)
    }
  }

  const handleCreateCapability = (): void => {
    setSelectedDocument(null)
    navigate('/create/capability')
  }

  const handleCreateEnabler = (): void => {
    setSelectedDocument(null)
    navigate('/create/enabler')
  }

  const handleBackClick = (): void => {
    goBack()
  }

  const filteredEnablers = (selectedCapability && filterEnablersByCapability)
    ? enablers.filter(enabler => enabler.capabilityId === selectedCapability.id)
    : enablers

  const groupCapabilitiesBySystemComponent = (capabilitiesList: Capability[]): Record<string, Capability[]> => {
    const groups: Record<string, Capability[]> = {}

    capabilitiesList.forEach(capability => {
      const system = capability.system?.trim()
      const component = capability.component?.trim()

      if (system && component) {
        const groupKey = `${system} | ${component}`

        if (!groups[groupKey]) {
          groups[groupKey] = []
        }
        groups[groupKey].push(capability)
      } else {
        if (!groups['Unassigned']) {
          groups['Unassigned'] = []
        }
        groups['Unassigned'].push(capability)
      }
    })

    return groups
  }

  const capabilityGroups = useMemo(() => groupCapabilitiesBySystemComponent(capabilities), [capabilities])

  // Detect workspace changes and reset expansion states
  useEffect(() => {
    if (previousWorkspaceId !== null && previousWorkspaceId !== activeWorkspaceId) {
      // Workspace has changed, collapse all sections
      console.log('Workspace change detected, collapsing all sections')
      setExpandedSections({
        capabilities: false,
        enablers: false,
        todos: false
      })
      setExpandedComponentGroups({})
    }

    setPreviousWorkspaceId(activeWorkspaceId)
  }, [activeWorkspaceId, previousWorkspaceId])

  // Initialize expanded state for new component groups (closed by default)
  useEffect(() => {
    setExpandedComponentGroups(prev => {
      const newState = { ...prev }
      Object.keys(capabilityGroups).forEach(groupKey => {
        if (!(groupKey in newState)) {
          newState[groupKey] = false // Closed by default
        }
      })
      return newState
    })
  }, [capabilityGroups])

  const getAssociatedCapabilityId = (): string | null => {
    if (selectedDocument?.type === 'enabler') {
      const selectedEnabler = enablers.find(enabler => enabler.path === selectedDocument.path)
      return selectedEnabler?.capabilityId || null
    }
    return null
  }

  const associatedCapabilityId = getAssociatedCapabilityId()

  // The To Do pane only claims height while it is switched on and expanded
  const effectiveTodosHeight = (config?.todoTracking !== false) && expandedSections.todos ? todosHeight : 0

  // To Do tracking can be switched off in Settings -> Basic Configuration
  const todoTrackingEnabled = config?.todoTracking !== false

  // The document to add new to dos to: the selected enabler when one is open,
  // otherwise the selected capability
  const todoTarget = useMemo(() => {
    if (selectedDocument?.type === 'enabler') {
      const enabler = enablers.find(item => item.path === selectedDocument.path)
      if (enabler) {
        return { kind: 'Enabler', name: enabler.title || enabler.name || enabler.path, path: enabler.path, todos: (enabler.todos || []) as TodoItem[] }
      }
    }

    if (selectedDocument?.type === 'capability') {
      const capability = capabilities.find(item => item.path === selectedDocument.path)
      if (capability) {
        return { kind: 'Capability', name: capability.title || capability.name || capability.path, path: capability.path, todos: (capability.todos || []) as TodoItem[] }
      }
    }

    if (selectedCapability) {
      const capability = capabilities.find(item => item.path === selectedCapability.path) || selectedCapability
      return { kind: 'Capability', name: capability.title || capability.name || capability.path, path: capability.path, todos: (capability.todos || []) as TodoItem[] }
    }

    return null
  }, [selectedDocument, selectedCapability, capabilities, enablers])

  // To dos are listed by their Order column, 1 at the top. With the filter on the list
  // follows the current selection, with it off every to do in the workspace is shown.
  const todoEntries = useMemo(() => {
    const toEntries = (
      source: { kind: string; name: string; path: string; todos: TodoItem[] }
    ) => sortTodos(source.todos || []).map(todo => ({
      todo,
      sourceKind: source.kind,
      sourceName: source.name,
      sourcePath: source.path
    }))

    if (filterTodosBySelection) {
      return todoTarget ? toEntries(todoTarget) : []
    }

    const allSources = [
      ...capabilities.map(capability => ({
        kind: 'Capability',
        name: capability.title || capability.name || capability.path,
        path: capability.path,
        todos: (capability.todos || []) as TodoItem[]
      })),
      ...enablers.map(enabler => ({
        kind: 'Enabler',
        name: enabler.title || enabler.name || enabler.path,
        path: enabler.path,
        todos: (enabler.todos || []) as TodoItem[]
      }))
    ]
      .filter(source => source.todos.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name))

    return allSources.flatMap(toEntries)
  }, [filterTodosBySelection, todoTarget, capabilities, enablers])

  const handleTodoClick = (entry: { sourceKind: string; sourcePath: string }): void => {
    navigate(`/view/${entry.sourceKind.toLowerCase()}/${entry.sourcePath}`)
  }

  // Toggle a to do between Done and To Do straight from the explorer. Only the one
  // table cell is rewritten, so the rest of the document is left untouched.
  const handleToggleTodoDone = async (
    entry: { todo: TodoItem; sourcePath: string },
    done: boolean
  ): Promise<void> => {
    const status = done ? 'Done' : 'To Do'
    setPendingTodo(`${entry.sourcePath}-${entry.todo.order}-${entry.todo.name}`)

    try {
      const file = await apiService.getFile(entry.sourcePath)
      const updated = setTodoStatusInMarkdown(file.content, entry.todo, status)

      if (updated === file.content) {
        toast.error('Could not find that to do in the document')
        return
      }

      suppressExternalChangeNotification(entry.sourcePath)
      await apiService.saveFile(entry.sourcePath, updated)
      refreshData()
    } catch (error) {
      toast.error(`Failed to update to do: ${(error as Error).message}`)
    } finally {
      setPendingTodo(null)
    }
  }

  // Add a to do to the selected capability or enabler without leaving the explorer
  const handleCreateTodo = async (): Promise<void> => {
    if (!todoTarget) {
      toast.error('Select a capability or enabler first')
      return
    }

    const name = window.prompt(`New to do for ${todoTarget.name}`)
    if (name === null) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('A to do needs a name')
      return
    }

    try {
      const file = await apiService.getFile(todoTarget.path)
      const existing = parseTodosTable(file.content)
      const nextOrder = existing.reduce((max, todo) => Math.max(max, Number(todo.order) || 0), 0) + 1
      const updated = upsertTodosInMarkdown(file.content, [
        ...existing,
        { order: nextOrder, name: trimmedName, description: '', status: 'To Do' }
      ])

      suppressExternalChangeNotification(todoTarget.path)
      await apiService.saveFile(todoTarget.path, updated)
      refreshData()
      toast.success(`Added to do to ${todoTarget.name}`)
    } catch (error) {
      toast.error(`Failed to add to do: ${(error as Error).message}`)
    }
  }

  // Handle resizer drag functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !sidebarRef.current) return

    const rect = sidebarRef.current.getBoundingClientRect()
    const totalHeight = rect.height - 120 // Account for header and padding
    const relativeY = e.clientY - rect.top - 60 // Account for header
    const percentage = Math.max(20, Math.min(80, (relativeY / totalHeight) * 100))

    setCapabilitiesHeight(percentage)
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Drag the To Do grabber to give the list more or less room
  const handleTodosMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingTodos(true)
  }, [])

  const handleTodosMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingTodos || !sidebarRef.current) return

    const rect = sidebarRef.current.getBoundingClientRect()
    const totalHeight = rect.height - 120 // Account for header and padding
    const distanceFromBottom = rect.bottom - e.clientY
    const percentage = Math.max(10, Math.min(70, (distanceFromBottom / totalHeight) * 100))

    setTodosHeight(percentage)
  }, [isDraggingTodos])

  const handleTodosMouseUp = useCallback(() => {
    setIsDraggingTodos(false)
  }, [])

  useEffect(() => {
    if (isDraggingTodos) {
      document.addEventListener('mousemove', handleTodosMouseMove)
      document.addEventListener('mouseup', handleTodosMouseUp)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'ns-resize'
    } else {
      document.removeEventListener('mousemove', handleTodosMouseMove)
      document.removeEventListener('mouseup', handleTodosMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleTodosMouseMove)
      document.removeEventListener('mouseup', handleTodosMouseUp)
    }
  }, [isDraggingTodos, handleTodosMouseMove, handleTodosMouseUp])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'ns-resize'
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  if (loading) {
    return (
      <div className="bg-card text-foreground rounded-[10px] p-6 shadow-md overflow-y-auto max-h-[calc(100vh-120px)]">
        <div className="flex items-center justify-center p-8 text-primary">
          <div className="spinner"></div>
          Loading...
        </div>
      </div>
    )
  }

  // Show search results if there's a search term
  if (searchTerm.trim()) {
    return (
      <div className="bg-card text-foreground rounded-[10px] p-6 shadow-md overflow-y-auto max-h-[calc(100vh-120px)]">
        {navigationHistory.length > 0 && (
          <button onClick={handleBackClick} className="flex items-center gap-2 py-2 px-4 mb-4 bg-card/70 border border-border rounded cursor-pointer text-sm text-primary w-full transition-all duration-150 ease-in-out backdrop-blur-[1px] hover:bg-accent hover:text-primary/80 hover:backdrop-blur-[2px]">
            <ArrowLeft size={16} />
            Back
          </button>
        )}

        <div className="mb-6">
          <h4 className="text-lg font-semibold text-foreground border-b-2 border-primary pb-2 mb-4">
            Search Results for "{searchTerm}"
          </h4>

          {searchResults.capabilities.length > 0 && (
            <div className="mb-6">
              <h5 className="text-md font-medium text-foreground mb-3 flex items-center gap-2">
                <Box size={16} />
                Capabilities ({searchResults.capabilities.length})
              </h5>
              <div className="ml-4 border-l-2 border-primary/20 pl-2 space-y-1">
                {searchResults.capabilities.map((capability) => {
                  const isActive = selectedDocument?.type === 'capability' && selectedDocument?.path === capability.path
                  const isImplemented = capability.status === 'Implemented'
                  return (
                    <div
                      key={`${capability.path}-${capability.status}-${capability.approval}`}
                      className={`flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-all duration-150 ease-in-out text-sm ${capability.approval === 'Not Approved' ? 'text-gray-400' : 'text-foreground'} ${
                        isActive
                          ? 'bg-primary/80 text-primary-foreground backdrop-blur-sm'
                          : 'hover:bg-accent hover:text-accent-foreground hover:backdrop-blur-sm'
                      } relative`}
                      onClick={() => handleCapabilityClick(capability)}
                    >
                      <Zap size={16} className={isImplemented ? 'text-yellow-500 fill-yellow-500' : ''} />
                      <span className="flex-1 break-words">{capability.title || capability.name}</span>
                      {capability.id && <small className="text-xs opacity-70">({capability.id})</small>}
                      {capability.status === 'In Analysis' && (
                        <Microscope size={19} className="text-blue-500 ml-1" />
                      )}
                      {capability.status === 'In Design' && (
                        <Ruler size={19} className="text-blue-500 ml-1" />
                      )}
                      {capability.status === 'In Implementation' && (
                        <img src="/anvil.png" style={{width: '29px', height: '29px'}} className="ml-1" alt="Implementation" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {searchResults.enablers.length > 0 && (
            <div className="mb-6">
              <h5 className="text-md font-medium text-foreground mb-3 flex items-center gap-2">
                <Zap size={16} />
                Enablers ({searchResults.enablers.length})
              </h5>
              <div className="ml-4 border-l-2 border-primary/20 pl-2 space-y-1">
                {searchResults.enablers.map((enabler) => {
                  const isActive = selectedDocument?.type === 'enabler' && selectedDocument?.path === enabler.path
                  const isImplemented = enabler.status === 'Implemented'
                  return (
                    <div
                      key={`${enabler.path}-${enabler.status}-${enabler.approval}`}
                      className={`flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-all duration-150 ease-in-out text-sm ${enabler.approval === 'Not Approved' ? 'text-gray-400' : 'text-foreground'} ${
                        isActive
                          ? 'bg-primary/80 text-primary-foreground backdrop-blur-sm'
                          : 'hover:bg-accent hover:text-accent-foreground hover:backdrop-blur-sm'
                      } relative`}
                      onClick={() => handleEnablerClick(enabler)}
                    >
                      <Zap size={16} className={isImplemented ? 'text-yellow-500 fill-yellow-500' : ''} />
                      <span className="flex-1 break-words">{enabler.title || enabler.name}</span>
                      {enabler.id && <small className="text-xs opacity-70">({enabler.id})</small>}
                      {enabler.status === 'In Analysis' && (
                        <Microscope size={19} className="text-blue-500 ml-1" />
                      )}
                      {enabler.status === 'In Design' && (
                        <Ruler size={19} className="text-blue-500 ml-1" />
                      )}
                      {enabler.status === 'In Implementation' && (
                        <img src="/anvil.png" style={{width: '29px', height: '29px'}} className="ml-1" alt="Implementation" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {searchResults.requirements.length > 0 && (
            <div className="mb-6">
              <h5 className="text-md font-medium text-foreground mb-3 flex items-center gap-2">
                <FileText size={16} />
                Requirements ({searchResults.requirements.length})
              </h5>
              <div className="ml-4 border-l-2 border-primary/20 pl-2 space-y-1">
                {searchResults.requirements.map((requirement, index) => (
                  <div
                    key={`${requirement.enablerID}-${requirement.id}-${index}`}
                    className="flex items-start gap-3 py-2 px-3 rounded-md cursor-pointer transition-all duration-150 ease-in-out text-foreground text-sm hover:bg-accent hover:text-accent-foreground hover:backdrop-blur-sm"
                    onClick={() => handleRequirementClick(requirement)}
                  >
                    <FileText size={16} className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block font-medium">{requirement.name || requirement.id}</span>
                      <small className="text-xs text-muted-foreground">
                        {requirement.type} • in {requirement.enablerName}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchResults.capabilities.length === 0 &&
           searchResults.enablers.length === 0 &&
           searchResults.requirements.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No results found for "{searchTerm}"</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={sidebarRef} className="bg-card text-foreground rounded-[10px] p-6 shadow-md flex flex-col max-h-[calc(100vh-120px)]">
      {navigationHistory.length > 0 && (
        <button onClick={handleBackClick} className="flex items-center gap-2 py-2 px-4 mb-4 bg-card/70 border border-border rounded cursor-pointer text-sm text-primary w-full transition-all duration-150 ease-in-out backdrop-blur-[1px] hover:bg-accent hover:text-primary/80 hover:backdrop-blur-[2px]">
          <ArrowLeft size={16} />
          Back
        </button>
      )}

      <div
        className="flex flex-col min-h-0"
        style={{ height: `${100 - effectiveTodosHeight}%` }}
      >
      <div
        className="flex flex-col min-h-0"
        style={{ height: `${capabilitiesHeight}%` }}
      >
        {/* Sticky Capabilities Header */}
        <div
          className="flex items-center gap-2 py-3 font-semibold text-xl text-foreground cursor-pointer border-b-2 border-primary mb-3 justify-between uppercase tracking-wide hover:text-foreground/90 bg-card sticky top-0 z-10"
          onClick={(): void => toggleSection('capabilities')}
        >
          {expandedSections.capabilities ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="flex-1 ml-2">Capabilities</span>
          <button
            onClick={(e: React.MouseEvent<HTMLButtonElement>): void => {
              e.stopPropagation()
              handleCreateCapability()
            }}
            className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors duration-200 shadow-sm border border-primary/20"
            title="Create New Capability"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable Capabilities Content */}
        {expandedSections.capabilities && (
          <div className="overflow-y-auto flex-1">
          <div className="flex flex-col gap-1">
            {Object.entries(capabilityGroups)
              .sort(([a], [b]) => {
                if (a === 'Unassigned') return 1
                if (b === 'Unassigned') return -1
                return a.localeCompare(b)
              })
              .map(([groupKey, groupCapabilities]) => {
                // Check if all capabilities in this group are implemented
                const allImplemented = groupCapabilities.length > 0 && groupCapabilities.every(cap => cap.status === 'Implemented')

                // Blue icon when all capabilities in group are implemented

                return (
                <div key={groupKey} className="mb-4">
                  <div
                    className="flex items-center gap-3 py-3 px-3 rounded-md transition-all duration-150 ease-in-out text-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    onClick={() => toggleComponentGroup(groupKey)}
                  >
                    {expandedComponentGroups[groupKey] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Box size={16} className={allImplemented ? 'text-blue-400 fill-blue-400 stroke-black stroke-1' : ''} />
                    <span>{groupKey}</span>
                  </div>
                  {expandedComponentGroups[groupKey] && (
                    <div className="ml-4 border-l-2 border-primary/20 pl-2">
                    {groupCapabilities
                      .sort((a, b) => {
                        const nameA = (a.title || a.name || '').toLowerCase()
                        const nameB = (b.title || b.name || '').toLowerCase()
                        return nameA.localeCompare(nameB)
                      })
                      .map((capability) => {
                        const isActive = selectedDocument?.type === 'capability' && selectedDocument?.path === capability.path
                        const isAssociated = !!associatedCapabilityId && capability.id === associatedCapabilityId
                        const isImplemented = capability.status === 'Implemented'

                        return (
                          <div
                            key={`${capability.path}-${capability.status}-${capability.approval}`}
                            className={`flex items-center gap-3 py-3 px-3 rounded-md cursor-pointer transition-all duration-150 ease-in-out mb-1 text-sm ${capability.approval === 'Not Approved' ? 'text-gray-400' : 'text-foreground'} ${
                              isActive
                                ? 'bg-primary/80 text-primary-foreground backdrop-blur-sm'
                                : isAssociated
                                ? 'bg-transparent border-2 border-primary/80 rounded-lg text-primary font-medium'
                                : 'hover:bg-accent hover:text-accent-foreground hover:backdrop-blur-sm'
                            } relative`}
                            onClick={(): void => handleCapabilityClick(capability)}
                          >
                            <Zap size={16} className={isImplemented ? 'text-yellow-500 fill-yellow-500' : ''} />
                            <span className="flex-1 break-words">{capability.title || capability.name}</span>
                            {capability.status === 'In Analysis' && (
                              <Microscope size={19} className="text-blue-500 ml-1" />
                            )}
                            {capability.status === 'In Design' && (
                              <Ruler size={19} className="text-blue-500 ml-1" />
                            )}
                            {capability.status === 'In Implementation' && (
                              <img src="/anvil.png" style={{width: '29px', height: '29px'}} className="ml-1" alt="Implementation" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                )
              })}
          </div>
          </div>
        )}
      </div>

      {/* Resizable separator */}
      <div
        className={`flex items-center justify-center h-3 cursor-ns-resize select-none transition-colors duration-200 ${
          isDragging ? 'bg-primary/20' : 'hover:bg-primary/10'
        }`}
        onMouseDown={handleMouseDown}
      >
        <GripHorizontal
          size={16}
          className={`text-muted-foreground transition-colors duration-200 ${
            isDragging ? 'text-primary' : 'hover:text-primary'
          }`}
        />
      </div>

      <div
        className="flex flex-col min-h-0"
        style={{ height: `${100 - capabilitiesHeight}%` }}
      >
        {/* Sticky Enablers Header */}
        <div
          className="flex items-center gap-2 py-3 font-semibold text-xl text-foreground cursor-pointer border-b-2 border-primary mb-3 justify-between uppercase tracking-wide hover:text-foreground/90 bg-card sticky top-0 z-10"
          onClick={(): void => toggleSection('enablers')}
        >
          {expandedSections.enablers ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="flex-1 ml-2">Enablers</span>
          <button
            onClick={(e: React.MouseEvent<HTMLButtonElement>): void => {
              e.stopPropagation()
              setFilterEnablersByCapability(!filterEnablersByCapability)
            }}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-200 shadow-sm border ${
              filterEnablersByCapability
                ? 'bg-primary text-primary-foreground border-primary/20 hover:bg-primary/90'
                : 'bg-secondary text-secondary-foreground border-secondary/20 hover:bg-secondary/90'
            }`}
            title={filterEnablersByCapability ? "Show All Enablers" : "Filter by Selected Capability"}
          >
            <Filter size={16} strokeWidth={2.5} />
          </button>
          <button
            onClick={(e: React.MouseEvent<HTMLButtonElement>): void => {
              e.stopPropagation()
              handleCreateEnabler()
            }}
            className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors duration-200 shadow-sm border border-primary/20"
            title="Create New Enabler"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable Enablers Content */}
        {expandedSections.enablers && (
          <div className="overflow-y-auto flex-1">
          <div className="ml-4 border-l-2 border-primary/20 pl-2">
            {filteredEnablers
              .sort((a, b) => {
                const nameA = (a.title || a.name || '').toLowerCase()
                const nameB = (b.title || b.name || '').toLowerCase()
                return nameA.localeCompare(nameB)
              })
              .map((enabler) => {
                const isActive = selectedDocument?.type === 'enabler' && selectedDocument?.path === enabler.path
                const isImplemented = enabler.status === 'Implemented'

                return (
                  <div
                    key={enabler.path}
                    className={`flex items-center gap-3 py-3 px-3 rounded-md cursor-pointer transition-all duration-150 ease-in-out mb-1 text-sm ${enabler.approval === 'Not Approved' ? 'text-gray-400' : 'text-foreground'} ${
                      isActive
                        ? 'bg-primary/80 text-primary-foreground backdrop-blur-sm'
                        : 'hover:bg-accent hover:text-accent-foreground hover:backdrop-blur-sm'
                    } ${isImplemented ? 'relative' : ''}`}
                    onClick={(): void => handleEnablerClick(enabler)}
                  >
                    <Zap size={16} className={isImplemented ? 'text-yellow-500 fill-yellow-500' : ''} />
                    <span className="flex-1 break-words">{enabler.title || enabler.name}</span>
                    {enabler.status === 'In Analysis' && (
                      <Microscope size={19} className="text-blue-500 ml-1" />
                    )}
                    {enabler.status === 'In Design' && (
                      <Ruler size={19} className="text-blue-500 ml-1" />
                    )}
                    {enabler.status === 'In Implementation' && (
                      <img src="/anvil.png" style={{width: '29px', height: '29px'}} className="ml-1" alt="Implementation" />
                    )}
                  </div>
                )
              })}
          </div>
          </div>
        )}
      </div>
      </div>

      {/* Resizable separator for the To Do list */}
      {todoTrackingEnabled && expandedSections.todos && (
        <div
          className={`flex items-center justify-center h-3 cursor-ns-resize select-none transition-colors duration-200 ${
            isDraggingTodos ? 'bg-primary/20' : 'hover:bg-primary/10'
          }`}
          onMouseDown={handleTodosMouseDown}
        >
          <GripHorizontal
            size={16}
            className={`text-muted-foreground transition-colors duration-200 ${
              isDraggingTodos ? 'text-primary' : 'hover:text-primary'
            }`}
          />
        </div>
      )}

      {/* To Do Section - follows the current selection, or lists every to do with the filter off */}
      {todoTrackingEnabled && (
        <div
          className={`flex flex-col min-h-0 ${expandedSections.todos ? '' : 'flex-shrink-0 mt-2'}`}
          style={expandedSections.todos ? { height: `${todosHeight}%` } : undefined}
        >
          <div
            className="flex items-center gap-2 py-3 font-semibold text-xl text-foreground cursor-pointer border-b-2 border-primary mb-3 justify-between uppercase tracking-wide hover:text-foreground/90 bg-card"
            onClick={(): void => toggleSection('todos')}
          >
            {expandedSections.todos ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="flex-1 ml-2">To Do</span>
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>): void => {
                e.stopPropagation()
                setFilterTodosBySelection(!filterTodosBySelection)
              }}
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-200 shadow-sm border ${
                filterTodosBySelection
                  ? 'bg-primary text-primary-foreground border-primary/20 hover:bg-primary/90'
                  : 'bg-secondary text-secondary-foreground border-secondary/20 hover:bg-secondary/90'
              }`}
              title={filterTodosBySelection ? 'Show All To Dos' : 'Filter by Selected Capability or Enabler'}
            >
              <Filter size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>): void => {
                e.stopPropagation()
                handleCreateTodo()
              }}
              className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors duration-200 shadow-sm border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              title={todoTarget ? `Add To Do to ${todoTarget.name}` : 'Select a capability or enabler first'}
              disabled={!todoTarget}
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>

          {expandedSections.todos && (
            <div className="overflow-y-auto flex-1 min-h-0">
              {todoEntries.length === 0 ? (
                <div className="text-sm text-muted-foreground px-3 py-2">
                  {filterTodosBySelection
                    ? (todoTarget
                        ? `No to dos for this ${todoTarget.kind.toLowerCase()}.`
                        : 'Select a capability or enabler to see its to dos.')
                    : 'No to dos in this workspace yet.'}
                </div>
              ) : (
                <div className="ml-4 border-l-2 border-primary/20 pl-2">
                  {todoEntries.map((entry, index) => {
                    const isDone = entry.todo.status === 'Done'
                    const todoKey = `${entry.sourcePath}-${entry.todo.order}-${entry.todo.name}`

                    return (
                      <div
                        key={`${todoKey}-${index}`}
                        className={`flex items-start gap-2 py-2 px-3 rounded-md cursor-pointer transition-all duration-150 ease-in-out mb-1 text-sm hover:bg-accent hover:text-accent-foreground hover:backdrop-blur-sm ${
                          isDone ? 'text-muted-foreground' : 'text-foreground'
                        }`}
                        onClick={(): void => handleTodoClick(entry)}
                        title={`${entry.todo.description || entry.todo.name}${filterTodosBySelection ? '' : ` - ${entry.sourceName}`}`}
                      >
                        <input
                          type="checkbox"
                          checked={isDone}
                          disabled={pendingTodo === todoKey}
                          onClick={(e: React.MouseEvent<HTMLInputElement>): void => e.stopPropagation()}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
                            e.stopPropagation()
                            handleToggleTodoDone(entry, e.target.checked)
                          }}
                          className="mt-1 w-4 h-4 flex-shrink-0 rounded border-border text-primary focus:ring-ring focus:ring-2 disabled:opacity-50"
                          title={isDone ? 'Mark as To Do' : 'Mark as Done'}
                        />
                        <span className={`flex-1 min-w-0 break-words ${isDone ? 'line-through' : ''}`}>
                          {entry.todo.name || entry.todo.description}
                        </span>
                        <span className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full border border-primary/40 bg-primary/10 text-primary text-[10px] font-semibold leading-none">
                          {entry.todo.order || index + 1}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
