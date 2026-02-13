import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { tasks as tasksApi, projects as projectsApi } from '../api/client';
import ConfirmModal from '../components/ConfirmModal';
import Loader from '../components/Loader';

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
  const [projects, setProjects] = useState([]);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [date, setDate] = useState(getLocalDateString());
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState('');
  const [adding, setAdding] = useState(false);
  const [searchToday, setSearchToday] = useState('');
  const [searchProjects, setSearchProjects] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState('medium');
  const [editTaskRecurrence, setEditTaskRecurrence] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const addInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchDaily() {
      try {
        const { data } = await tasksApi.list({ date });
        if (!cancelled) setDailyTasks(data);
      } catch {
        if (!cancelled) setDailyTasks([]);
      }
    }
    if (tab === 'today') fetchDaily();
    return () => { cancelled = true; };
  }, [tab, date]);

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

  useEffect(() => {
    if (tab !== 'projects') return;
    let cancelled = false;

    // Capture and clear navigation state (new project created)
    const newProject = location.state?.newProject;
    if (newProject) {
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }

    async function fetchProjects() {
      setProjectsLoading(true);
      try {
        // Only fetch top-level projects (parentId: null)
        const { data } = await projectsApi.list({ includeArchived: true, parentId: 'null' });
        if (!cancelled) {
          let active = data.filter((p) => !p.archived);
          // If the API response doesn't include the just-created project yet, merge it in
          if (newProject && !newProject.parentId && !active.some((p) => p._id === newProject._id)) {
            active = [{ ...newProject, totalTasks: 0, completedTasks: 0, subProjectCount: 0 }, ...active];
          }
          setProjects(active);
          setArchivedProjects(data.filter((p) => p.archived));
        }
      } catch {
        if (!cancelled) {
          // On error, at least show the new project if we have one
          if (newProject && !newProject.parentId) {
            setProjects([{ ...newProject, totalTasks: 0, completedTasks: 0, subProjectCount: 0 }]);
          } else {
            setProjects([]);
          }
          setArchivedProjects([]);
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }
    fetchProjects();
    return () => { cancelled = true; };
  }, [tab]);

  useEffect(() => {
    setLoading(false);
  }, []);

  async function handleAddDailyTask(e) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      const payload = { title, priority: newTaskPriority };
      if (newTaskRecurrence) {
        payload.recurrenceRule = newTaskRecurrence;
      } else {
        payload.date = new Date(date).toISOString();
      }
      const { data } = await tasksApi.create(payload);
      setDailyTasks((prev) => [...prev, data]);
      setNewTaskTitle('');
      setNewTaskRecurrence('');
      addInputRef.current?.focus();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  }

  async function toggleDailyTask(task) {
    try {
      const completed = !task.completed;
      const payload = task.recurrenceRule ? { completed, date } : { completed };
      const { data } = await tasksApi.update(task._id, payload);
      setDailyTasks((prev) => prev.map((t) => (t._id === task._id ? data : t)));
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteDailyTask(task) {
    try {
      await tasksApi.delete(task._id);
      setDailyTasks((prev) => prev.filter((t) => t._id !== task._id));
    } catch (err) {
      console.error(err);
    }
  }

  async function moveDailyTask(task, direction) {
    const idx = dailyTasks.findIndex((t) => t._id === task._id);
    if (idx < 0) return;
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (otherIdx < 0 || otherIdx >= dailyTasks.length) return;
    const other = dailyTasks[otherIdx];
    try {
      await Promise.all([
        tasksApi.update(task._id, { order: other.order ?? otherIdx }),
        tasksApi.update(other._id, { order: task.order ?? idx }),
      ]);
      setDailyTasks((prev) => {
        const next = [...prev];
        [next[idx], next[otherIdx]] = [next[otherIdx], next[idx]];
        return next;
      });
    } catch (err) {
      console.error(err);
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
    try {
      // Note: Changing recurrence type requires deleting and recreating the task
      // because the backend has constraints (can't have both date and recurrenceRule)
      const currentRecurrence = task.recurrenceRule || '';
      const recurrenceChanged = currentRecurrence !== editTaskRecurrence;

      if (recurrenceChanged) {
        // Need to delete and recreate the task
        await tasksApi.delete(task._id);
        const payload = {
          title,
          priority: editTaskPriority,
        };
        if (editTaskRecurrence) {
          payload.recurrenceRule = editTaskRecurrence;
        } else {
          payload.date = new Date(date).toISOString();
        }
        const { data } = await tasksApi.create(payload);
        // Replace old task with new one
        setDailyTasks((prev) => {
          const filtered = prev.filter((t) => t._id !== task._id);
          return [...filtered, data];
        });
      } else {
        // Same type, just update
        const { data } = await tasksApi.update(task._id, {
          title,
          priority: editTaskPriority,
        });
        setDailyTasks((prev) => prev.map((t) => (t._id === task._id ? data : t)));
      }
      cancelEditDailyTask();
    } catch (err) {
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
      onConfirm: async () => {
        try {
          await projectsApi.delete(project._id);
          if (isArchived) {
            setArchivedProjects((prev) => prev.filter((p) => p._id !== project._id));
          } else {
            setProjects((prev) => prev.filter((p) => p._id !== project._id));
          }
          setConfirmModal(null);
        } catch (err) {
          console.error(err);
          setConfirmModal(null);
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  }

  async function moveProject(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= projects.length) return;

    const newProjects = [...projects];
    [newProjects[index], newProjects[targetIndex]] = [newProjects[targetIndex], newProjects[index]];

    try {
      await projectsApi.reorder(newProjects.map((p) => p._id));
      setProjects(newProjects);
    } catch (err) {
      console.error(err);
    }
  }

  const filteredTodayTasks = searchToday.trim()
    ? dailyTasks.filter((t) => t.title.toLowerCase().includes(searchToday.toLowerCase()))
    : dailyTasks;
  const filteredProjects = searchProjects.trim()
    ? projects.filter(
      (p) =>
        p.name.toLowerCase().includes(searchProjects.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchProjects.toLowerCase())
    )
    : projects;

  const completedCount = dailyTasks.filter((t) => t.completed).length;
  const totalCount = dailyTasks.length;
  const completedPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Task Manager</h1>

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
              disabled={adding || !newTaskTitle.trim()}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              Add
            </button>
          </form>
          <ul className="space-y-2">
            {filteredTodayTasks.map((task) => {
              const isEditing = editingTaskId === task._id;

              if (isEditing) {
                return (
                  <li
                    key={task._id}
                    className="bg-white border border-emerald-300 rounded-lg px-4 py-3 shadow-sm"
                  >
                    <div className="flex flex-wrap gap-2 items-center">
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
                        type="button"
                        onClick={() => saveEditDailyTask(task)}
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
                    </div>
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
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
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
                      disabled={filteredTodayTasks.indexOf(task) === 0}
                      className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDailyTask(task, 'down')}
                      disabled={filteredTodayTasks.indexOf(task) === filteredTodayTasks.length - 1}
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
                    className="text-slate-400 hover:text-red-600 text-sm"
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
          {dailyTasks.length === 0 && !loading && (
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
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 text-sm w-48"
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
            {filteredProjects.map((project, index) => {
              const total = project.totalTasks ?? 0;
              const completed = project.completedTasks ?? 0;
              const percent = total ? Math.round((completed / total) * 100) : 0;
              const subCount = project.subProjectCount ?? 0;
              return (
                <div
                  key={project._id}
                  className="block bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-emerald-300 hover:shadow transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 
                      onClick={() => navigate(`/tasks/projects/${project._id}`)}
                      className="font-semibold text-slate-800 cursor-pointer flex-1"
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
                            moveProject(index, -1);
                          }}
                          disabled={index === 0}
                          className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveProject(index, 1);
                          }}
                          disabled={index === filteredProjects.length - 1}
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
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-sm text-slate-500 mt-1">{project.description}</p>
                  )}
                  <div 
                    onClick={() => navigate(`/tasks/projects/${project._id}`)}
                    className="mt-3 flex items-center gap-2 cursor-pointer"
                  >
                    <span className="text-sm font-medium text-emerald-600">{completed}/{total}</span>
                    <span className="text-sm text-slate-500">tasks</span>
                    <span className="text-sm font-bold text-slate-700">{percent}%</span>
                    {total > 0 && (
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden max-w-[120px]">
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
        />
      )}
    </div>
  );
}
