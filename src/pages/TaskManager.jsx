import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { tasks as tasksApi, projects as projectsApi } from '../api/client';
import { useProjects } from '../context/ProjectsContext';
import ConfirmModal from '../components/ConfirmModal';
import Loader from '../components/Loader';
import TaskManagerClock from '../components/TaskManagerClock';
import { useOptimisticTaskToggle } from '../hooks/useOptimisticTaskToggle';
import { useOptimisticTaskReorder } from '../hooks/useOptimisticTaskReorder';
import { useTaskListData } from '../hooks/useTaskListData';
import { sortTasks, reorderListToPosition } from '../lib/taskUtils';
import TaskPositionInput from '../components/TaskPositionInput';
import ButtonSpinner from '../components/ButtonSpinner';

const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_STYLES = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-100 text-slate-600',
};

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr) {
  // Convert yyyy-mm-dd to dd/mm/yy
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year.slice(2)}`;
}

export default function TaskManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tab = searchParams.get('tab') || 'today';
  const [dailyTasks, setDailyTasks] = useState([]);
  const {
    projects,
    setProjects,
    archivedProjects,
    projectsLoading,
    projectsLoaded,
    fetchProjects,
    addOptimisticProject,
    deleteProject,
  } = useProjects();
  const [showArchived, setShowArchived] = useState(false);
  const [date, setDate] = useState(getLocalDateString());
  const [dailyLoading, setDailyLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [searchToday, setSearchToday] = useState('');
  const [searchProjects, setSearchProjects] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState('medium');
  const [editTaskRecurrence, setEditTaskRecurrence] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const addInputRef = useRef(null);

  const fetchDailyTasks = useCallback(
    () => tasksApi.list({ date }).then((r) => r.data),
    [date]
  );

  const {
    loadTasks,
    debouncedRefresh,
    markTogglePending,
    removeTogglePending,
  } = useTaskListData({
    fetchTasks: fetchDailyTasks,
    setTasks: setDailyTasks,
  });

  const [prevTab, setPrevTab] = useState(tab);
  if (prevTab !== tab) {
    setPrevTab(tab);
    if (tab === 'today') {
      setDailyTasks([]);
      setDailyLoading(true);
    }
  }

  const [prevDate, setPrevDate] = useState(date);
  if (prevDate !== date) {
    setPrevDate(date);
    setDailyTasks([]);
    setDailyLoading(true);
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchDaily() {
      setDailyLoading(true);
      try {
        await loadTasks(true);
      } catch {
        if (!cancelled) setDailyTasks([]);
      } finally {
        if (!cancelled) setDailyLoading(false);
      }
    }
    if (tab === 'today') fetchDaily();
    return () => { cancelled = true; };
  }, [tab, date, loadTasks]);

  useEffect(() => {
    if (tab !== 'today') return;
    addInputRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (tab === 'today') {
        e.preventDefault();
        addInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tab]);

  const newProject = location.state?.newProject;
  const newProjectId = newProject?._id;

  useEffect(() => {
    if (tab !== 'projects') return;

    if (newProject && !newProject.parentId) {
      addOptimisticProject(newProject);
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }

    if (!projectsLoaded && !projectsLoading) {
      fetchProjects();
    }
  }, [
    tab,
    newProjectId,
    newProject,
    projectsLoaded,
    projectsLoading,
    fetchProjects,
    addOptimisticProject,
    navigate,
    location.pathname,
    location.search,
  ]);

  async function handleAddDailyTask(e) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    setAddingTask(true);
    setNewTaskTitle('');
    const savedRecurrence = newTaskRecurrence;
    const savedPriority = newTaskPriority;
    setNewTaskRecurrence('');

    const tempId = `temp-${Date.now()}`;
    const optimisticTask = {
      _id: tempId,
      title,
      priority: savedPriority,
      completed: false,
      recurrenceRule: savedRecurrence || undefined,
      date: savedRecurrence ? undefined : new Date(date).toISOString(),
      order: dailyTasks.length,
    };
    setDailyTasks((prev) => [...prev, optimisticTask]);

    try {
      const payload = { title, priority: savedPriority };
      if (savedRecurrence) {
        payload.recurrenceRule = savedRecurrence;
      } else {
        payload.date = new Date(date).toISOString();
      }
      const { data } = await tasksApi.create(payload);
      setDailyTasks((prev) => prev.map((t) => (t._id === tempId ? data : t)));
      addInputRef.current?.focus();
    } catch (err) {
      setDailyTasks((prev) => prev.filter((t) => t._id !== tempId));
      setNewTaskTitle(title);
      setNewTaskRecurrence(savedRecurrence);
      console.error(err);
    } finally {
      setAddingTask(false);
    }
  }

  const toggleDailyTask = useOptimisticTaskToggle({
    tasks: dailyTasks,
    setTasks: setDailyTasks,
    apiToggle: (taskId, dateStr) => tasksApi.toggle(taskId, dateStr),
    getToggleDate: (task) => (task.recurrenceRule ? date : undefined),
    markTogglePending,
    removeTogglePending,
    debouncedRefresh,
    onError: (err) => console.error('Failed to toggle task:', err),
  });
  const { moveTask: moveDailyTask, moveTaskToPosition: moveDailyTaskToPosition } =
    useOptimisticTaskReorder({
      setTasks: setDailyTasks,
      sortTasks,
    });

  async function deleteDailyTask(task) {
    const snapshot = dailyTasks;
    setDeletingTaskId(task._id);
    setDailyTasks((prev) => prev.filter((t) => t._id !== task._id));
    try {
      await tasksApi.delete(task._id);
    } catch (err) {
      setDailyTasks(snapshot);
      console.error(err);
    } finally {
      setDeletingTaskId(null);
    }
  }

  function startEditDailyTask(task) {
    setEditingTaskId(task._id);
    setEditTaskTitle(task.title);
    setEditTaskPriority(task.priority || 'medium');
    setEditTaskRecurrence(task.recurrenceRule || '');
  }

  function cancelEditDailyTask() {
    setEditingTaskId(null);
    setEditTaskTitle('');
    setEditTaskPriority('medium');
    setEditTaskRecurrence('');
  }

  async function saveEditDailyTask(task) {
    const title = editTaskTitle.trim();
    if (!title) return;

    const currentRecurrence = task.recurrenceRule || '';
    const recurrenceChanged = currentRecurrence !== editTaskRecurrence;
    const snapshot = dailyTasks;

    if (recurrenceChanged) {
      const optimisticTask = {
        ...task,
        title,
        priority: editTaskPriority,
        recurrenceRule: editTaskRecurrence || undefined,
        date: editTaskRecurrence ? undefined : task.date,
      };
      setDailyTasks((prev) => prev.map((t) => (t._id === task._id ? optimisticTask : t)));
      cancelEditDailyTask();

      try {
        const payload = { title, priority: editTaskPriority };
        if (editTaskRecurrence) {
          payload.recurrenceRule = editTaskRecurrence;
        } else {
          payload.date = new Date(date).toISOString();
        }
        const { data: newTask } = await tasksApi.create(payload);
        try {
          await tasksApi.delete(task._id);
          setDailyTasks((prev) => [...prev.filter((t) => t._id !== task._id), newTask]);
        } catch (deleteErr) {
          await tasksApi.delete(newTask._id).catch(() => {});
          setDailyTasks(snapshot);
          console.error(deleteErr);
        }
      } catch (err) {
        setDailyTasks(snapshot);
        console.error(err);
      }
      return;
    }

    const optimisticTask = { ...task, title, priority: editTaskPriority };
    setDailyTasks((prev) => prev.map((t) => (t._id === task._id ? optimisticTask : t)));
    cancelEditDailyTask();

    try {
      const { data } = await tasksApi.update(task._id, { title, priority: editTaskPriority });
      setDailyTasks((prev) => prev.map((t) => (t._id === task._id ? data : t)));
    } catch (err) {
      setDailyTasks(snapshot);
      console.error(err);
    }
  }

  function handleDeleteProject(e, project, isArchived = false) {
    e.stopPropagation(); // Prevent navigation
    const subCount = project.subProjectCount ?? 0;
    const taskCount = project.totalTasks ?? 0;
    const message = subCount > 0
      ? `Are you sure you want to delete "${project.name}"? This will also delete ${subCount} sub-project(s) and all their tasks.`
      : taskCount > 0
        ? `Are you sure you want to delete "${project.name}" and its ${taskCount} task(s)?`
        : `Are you sure you want to delete "${project.name}"?`;

    setConfirmModal({
      open: true,
      title: 'Delete Project',
      message: message,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      confirmLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: true } : null));
        try {
          await deleteProject(project._id, isArchived);
          setConfirmModal(null);
        } catch (err) {
          console.error(err);
          setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: false } : null));
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  }

  async function persistProjectReorder(reordered) {
    const snapshot = projects;
    setProjects(reordered);
    try {
      await projectsApi.reorder(reordered.map((p) => p._id));
    } catch (err) {
      setProjects(snapshot);
      console.error(err);
    }
  }

  function moveProject(projectId, direction) {
    const index = projects.findIndex((p) => p._id === projectId);
    if (index < 0) return;
    const reordered = reorderListToPosition(projects, projectId, index + 1 + direction);
    if (reordered) void persistProjectReorder(reordered);
  }

  function moveProjectToPosition(projectId, position) {
    const reordered = reorderListToPosition(projects, projectId, position);
    if (reordered) void persistProjectReorder(reordered);
  }

  const sortedDailyTasks = useMemo(() => sortTasks(dailyTasks), [dailyTasks]);
  const filteredTodayTasks = useMemo(() => {
    const q = searchToday.trim().toLowerCase();
    if (!q) return sortedDailyTasks;
    return sortedDailyTasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [sortedDailyTasks, searchToday]);
  const dailyTaskIndexById = useMemo(
    () => new Map(sortedDailyTasks.map((t, i) => [t._id, i])),
    [sortedDailyTasks]
  );
  const filteredProjects = useMemo(() => {
    const q = searchProjects.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
    );
  }, [projects, searchProjects]);

  const completedCount = dailyTasks.filter((t) => t.completed).length;
  const totalCount = dailyTasks.length;
  const completedPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Task Manager</h1>
        <TaskManagerClock />
      </div>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'today' })}
          className={`px-4 py-2 rounded-lg font-medium ${tab === 'today' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'projects' })}
          className={`px-4 py-2 rounded-lg font-medium ${tab === 'projects' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
        >
          Projects
        </button>
      </div>

      {tab === 'today' && (
        <>
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-slate-700">Date</label>
            <div className="relative flex items-center">
              <span className="text-lg font-semibold text-slate-800 pr-2">{formatDateDisplay(date)}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                title="Change date"
              />
              <span className="text-slate-400 pointer-events-none">📅</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">
                <span className="font-medium text-emerald-600">{completedCount}</span> of <span className="font-medium">{totalCount}</span> completed
              </span>
              <span className="text-lg font-bold text-emerald-600">{completedPercent}%</span>
            </div>
          </div>
          {totalCount > 0 && (
            <div className="mb-6">
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${completedPercent}%` }}
                />
              </div>
            </div>
          )}
          <div className="mb-4">
            <input
              type="text"
              value={searchToday}
              onChange={(e) => setSearchToday(e.target.value)}
              placeholder="Search tasks..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 text-sm"
            />
          </div>
          <p className="text-xs text-slate-400 mb-1">Press <kbd className="px-1 py-0.5 bg-slate-200 rounded">N</kbd> to focus add task</p>
          <form onSubmit={handleAddDailyTask} className="flex flex-wrap gap-2 mb-4">
            <input
              ref={addInputRef}
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a task..."
              className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400"
            />
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={newTaskRecurrence}
              onChange={(e) => setNewTaskRecurrence(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm"
            >
              <option value="">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
            <button
              type="submit"
              disabled={addingTask || !newTaskTitle.trim()}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              Add
            </button>
          </form>
          {dailyLoading && dailyTasks.length === 0 ? (
            <Loader message="Loading tasks..." />
          ) : (
          <ul className="space-y-2">
            {filteredTodayTasks.map((task) => {
              const isEditing = editingTaskId === task._id;
              const taskIndex = dailyTaskIndexById.get(task._id) ?? -1;

              if (isEditing) {
                return (
                  <li
                    key={task._id}
                    className="bg-white border border-emerald-300 rounded-lg px-4 py-3 shadow-sm"
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveEditDailyTask(task);
                      }}
                      className="flex flex-wrap gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={editTaskTitle}
                        onChange={(e) => setEditTaskTitle(e.target.value)}
                        className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                        placeholder="Task title"
                        autoFocus
                      />
                      <select
                        value={editTaskPriority}
                        onChange={(e) => setEditTaskPriority(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <select
                        value={editTaskRecurrence}
                        onChange={(e) => setEditTaskRecurrence(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm"
                      >
                        <option value="">One-time</option>
                        <option value="daily">Daily</option>
                        <option value="weekdays">Weekdays</option>
                        <option value="weekly">Weekly</option>
                      </select>
                      <button
                        type="submit"
                        disabled={!editTaskTitle.trim()}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditDailyTask}
                        className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </form>
                  </li>
                );
              }

              return (
                <li
                  key={task._id}
                  className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleDailyTask(task)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                      }`}
                  >
                    {task.completed && '✓'}
                  </button>
                  <span className={`flex-1 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                    {task.title}
                  </span>
                  {task.recurrenceRule && (
                    <span className="text-xs text-slate-400 capitalize">{task.recurrenceRule}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium}`}>
                    {PRIORITY_LABELS[task.priority] || 'Medium'}
                  </span>
                  <div className="flex items-center gap-0">
                    <button
                      type="button"
                      onClick={() => moveDailyTask(task, 'up')}
                      disabled={taskIndex <= 0}
                      className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDailyTask(task, 'down')}
                      disabled={taskIndex < 0 || taskIndex >= sortedDailyTasks.length - 1}
                      className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEditDailyTask(task)}
                    className="text-slate-400 hover:text-emerald-600 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDailyTask(task)}
                    disabled={deletingTaskId === task._id}
                    className="text-slate-400 hover:text-red-600 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {deletingTaskId === task._id ? (
                      <span className="inline-flex items-center gap-1">
                        <ButtonSpinner />
                        Deleting…
                      </span>
                    ) : (
                      'Delete'
                    )}
                  </button>
                  <TaskPositionInput
                    position={taskIndex + 1}
                    max={sortedDailyTasks.length}
                    onCommit={(pos) => moveDailyTaskToPosition(task, pos)}
                  />
                </li>
              );
            })}
          </ul>
          )}
          {dailyLoading && dailyTasks.length > 0 && (
            <p className="text-sm text-slate-500 mt-2">Refreshing tasks…</p>
          )}
          {!dailyLoading && dailyTasks.length === 0 && (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-slate-600 mb-2">No tasks for this day.</p>
              <p className="text-sm text-slate-500 mb-4">Add your first task above to get started.</p>
              <button
                type="button"
                onClick={() => addInputRef.current?.focus()}
                className="text-emerald-600 font-medium hover:underline"
              >
                Add a task
              </button>
            </div>
          )}
          {dailyTasks.length > 0 && filteredTodayTasks.length === 0 && (
            <p className="text-slate-500 text-sm">No tasks match your search.</p>
          )}
        </>
      )}

      {tab === 'projects' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <input
              type="text"
              value={searchProjects}
              onChange={(e) => setSearchProjects(e.target.value)}
              placeholder="Search projects..."
              className="flex-1 min-w-60 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 text-sm"
            />
            <Link
              to="/tasks/projects/new"
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700"
            >
              New project
            </Link>
          </div>
          {projectsLoading && projects.length === 0 && (
            <Loader message="Loading projects..." />
          )}
          <div className="grid gap-3">
            {filteredProjects.map((project) => {
              const total = project.totalTasks ?? 0;
              const completed = project.completedTasks ?? 0;
              const percent = total ? Math.round((completed / total) * 100) : 0;
              const subCount = project.subProjectCount ?? 0;
              const projectIndex = projects.findIndex((p) => p._id === project._id);
              return (
                <div
                  key={project._id}
                  onClick={() => navigate(`/tasks/projects/${project._id}`)}
                  className="block bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-emerald-300 hover:shadow transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2
                      className="font-semibold text-slate-800 flex-1"
                    >
                      {project.name}
                    </h2>
                    <div className="flex items-center gap-1">
                      {subCount > 0 && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {subCount} sub-project{subCount > 1 ? 's' : ''}
                        </span>
                      )}
                      <div className="flex items-center gap-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveProject(project._id, -1);
                          }}
                          disabled={projectIndex <= 0}
                          className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveProject(project._id, 1);
                          }}
                          disabled={projectIndex < 0 || projectIndex >= projects.length - 1}
                          className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(e, project)}
                        className="text-slate-400 hover:text-red-600 text-sm px-1"
                        title="Delete project"
                      >
                        Delete
                      </button>
                      <span onClick={(e) => e.stopPropagation()}>
                        <TaskPositionInput
                          position={projectIndex + 1}
                          max={projects.length}
                          onCommit={(pos) => moveProjectToPosition(project._id, pos)}
                        />
                      </span>
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-sm text-slate-500 mt-1">{project.description}</p>
                  )}
                  <div
                    className="mt-3 flex items-center gap-2"
                  >
                    <span className="text-sm font-medium text-emerald-600">{completed}/{total}</span>
                    <span className="text-sm text-slate-500">tasks</span>
                    <span className="text-sm font-bold text-slate-700">{percent}%</span>
                    {total > 0 && (
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden max-w-30">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {projects.length === 0 && !projectsLoading && (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-slate-600 mb-2">No projects yet.</p>
              <p className="text-sm text-slate-500 mb-4">Create a project to group tasks and track progress.</p>
              <Link
                to="/tasks/projects/new"
                className="inline-block bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700"
              >
                New project
              </Link>
            </div>
          )}
          {projects.length > 0 && filteredProjects.length === 0 && (
            <p className="text-slate-500 text-sm">No projects match your search.</p>
          )}
          {archivedProjects.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                {showArchived ? 'Hide' : 'Show'} archived ({archivedProjects.length})
              </button>
              {showArchived && (
                <div className="mt-3 grid gap-3">
                  {archivedProjects.map((project) => {
                    const total = project.totalTasks ?? 0;
                    const completed = project.completedTasks ?? 0;
                    const percent = total ? Math.round((completed / total) * 100) : 0;
                    return (
                      <div
                        key={project._id}
                        onClick={() => navigate(`/tasks/projects/${project._id}`)}
                        className="block bg-slate-50 border border-slate-200 rounded-xl p-4 opacity-80 hover:opacity-100 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="font-semibold text-slate-600">{project.name} <span className="text-xs font-normal">(archived)</span></h2>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProject(e, project, true)}
                            className="text-slate-400 hover:text-red-600 text-sm px-1"
                            title="Delete project"
                          >
                            Delete
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                          <span>{completed}/{total} tasks</span>
                          <span>{percent}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          variant={confirmModal.variant}
          onConfirm={confirmModal.onConfirm}
          onCancel={confirmModal.onCancel}
          confirmLoading={confirmModal.confirmLoading}
        />
      )}
    </div>
  );
}
