import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { projects as projectsApi, tasks as tasksApi } from '../api/client';
import Loader from '../components/Loader';

const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_STYLES = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-100 text-slate-600',
};

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d - today) / (24 * 60 * 60 * 1000));
  if (diff === 0) return { label: 'Due today', className: 'text-amber-700' };
  if (diff < 0) return { label: 'Overdue', className: 'text-red-600' };
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear().toString().slice(-2);
  return { label: `${day}/${month}/${year}`, className: 'text-slate-500' };
}

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const parentIdFromUrl = searchParams.get('parentId'); // For creating sub-projects
  const navigate = useNavigate();
  const isNew = projectId === 'new';
  const [project, setProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [subProjects, setSubProjects] = useState([]);
  const [parentChain, setParentChain] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [parentProject, setParentProject] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState('medium');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskNotes, setEditTaskNotes] = useState('');
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isNew) {
      setProject({ name: '', description: '' });
      setNameInput('');
      setDescriptionInput('');
      setProjectTasks([]);
      setSubProjects([]);
      setParentChain([]);
      setLoading(false);
      // If creating a sub-project, fetch parent info
      if (parentIdFromUrl) {
        projectsApi.get(parentIdFromUrl).then(({ data }) => {
          setParentProject(data);
          setParentChain(data.parentChain ? [...data.parentChain, { _id: data._id, name: data.name }] : [{ _id: data._id, name: data.name }]);
        }).catch(() => { });
      }
      return;
    }
    let cancelled = false;
    async function fetchProject() {
      try {
        const [projRes, tasksRes] = await Promise.all([
          projectsApi.get(projectId),
          tasksApi.list({ projectId }),
        ]);
        if (cancelled) return;
        const proj = projRes.data;
        if (!proj) {
          navigate('/tasks?tab=projects');
          return;
        }
        setProject(proj);
        setNameInput(proj.name);
        setDescriptionInput(proj.description || '');
        setProjectTasks(tasksRes.data);
        setSubProjects(proj.subProjects || []);
        setParentChain(proj.parentChain || []);
      } catch {
        if (!cancelled) navigate('/tasks?tab=projects');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProject();
    return () => { cancelled = true; };
  }, [projectId, isNew, navigate, parentIdFromUrl]);

  useEffect(() => {
    if (isNew && nameInputRef.current) nameInputRef.current.focus();
  }, [isNew]);

  async function handleCreateProject(e) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    setAdding(true);
    try {
      const payload = { name, description: descriptionInput.trim() };
      if (parentIdFromUrl) payload.parentId = parentIdFromUrl;
      await projectsApi.create(payload);
      navigate(parentIdFromUrl ? `/tasks/projects/${parentIdFromUrl}` : '/tasks?tab=projects', { replace: true });
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdateProject() {
    if (!project || isNew) return;
    const name = nameInput.trim();
    if (!name) return;
    try {
      const { data } = await projectsApi.update(project._id, {
        name,
        description: descriptionInput.trim(),
      });
      setProject(data);
      setEditingName(false);
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleArchive() {
    if (!project || isNew) return;
    try {
      const { data } = await projectsApi.update(project._id, { archived: !project.archived });
      setProject(data);
      if (data.archived) navigate('/tasks?tab=projects');
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteProject() {
    if (!project || isNew) return;
    const subCount = subProjects.length;
    const taskCount = projectTasks.length;
    const message = subCount > 0
      ? `Are you sure you want to delete "${project.name}"? This will also delete ${subCount} sub-project(s) and all their tasks.`
      : taskCount > 0
        ? `Are you sure you want to delete "${project.name}" and its ${taskCount} task(s)?`
        : `Are you sure you want to delete "${project.name}"?`;
    if (!window.confirm(message)) return;
    try {
      await projectsApi.delete(project._id);
      // Navigate to parent project or task manager
      const destination = parentChain.length > 0 ? `/tasks/projects/${parentChain[parentChain.length - 1]._id}` : '/tasks?tab=projects';
      navigate(destination);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddTask(e) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || !project?._id) return;
    setAdding(true);
    try {
      const payload = { title, projectId: project._id, priority: newTaskPriority };
      if (newTaskDueDate) payload.dueDate = new Date(newTaskDueDate).toISOString();
      if (newTaskNotes.trim()) payload.notes = newTaskNotes.trim();
      const { data } = await tasksApi.create(payload);
      setProjectTasks((prev) => [...prev, data]);
      setNewTaskTitle('');
      setNewTaskDueDate('');
      setNewTaskNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  }

  async function toggleTask(task) {
    try {
      const { data } = await tasksApi.update(task._id, { completed: !task.completed });
      setProjectTasks((prev) => prev.map((t) => (t._id === task._id ? data : t)));
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteTask(task) {
    try {
      await tasksApi.delete(task._id);
      setProjectTasks((prev) => prev.filter((t) => t._id !== task._id));
    } catch (err) {
      console.error(err);
    }
  }

  function startEditTask(task) {
    setEditingTaskId(task._id);
    setEditTaskTitle(task.title);
    setEditTaskPriority(task.priority || 'medium');
    setEditTaskDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '');
    setEditTaskNotes(task.notes || '');
  }

  function cancelEditTask() {
    setEditingTaskId(null);
    setEditTaskTitle('');
    setEditTaskPriority('medium');
    setEditTaskDueDate('');
    setEditTaskNotes('');
  }

  async function saveEditTask(task) {
    const title = editTaskTitle.trim();
    if (!title) return;
    try {
      const payload = {
        title,
        priority: editTaskPriority,
        notes: editTaskNotes.trim(),
      };
      if (editTaskDueDate) {
        payload.dueDate = new Date(editTaskDueDate).toISOString();
      } else {
        payload.dueDate = null;
      }
      const { data } = await tasksApi.update(task._id, payload);
      setProjectTasks((prev) => prev.map((t) => (t._id === task._id ? data : t)));
      cancelEditTask();
    } catch (err) {
      console.error(err);
    }
  }

  async function moveTask(task, direction) {
    const sorted = [...projectTasks].sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return (a.order || 0) - (b.order || 0);
    });
    const idx = sorted.findIndex((t) => t._id === task._id);
    if (idx < 0) return;
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (otherIdx < 0 || otherIdx >= sorted.length) return;
    const other = sorted[otherIdx];
    try {
      await Promise.all([
        tasksApi.update(task._id, { order: other.order ?? otherIdx }),
        tasksApi.update(other._id, { order: task.order ?? idx }),
      ]);
      setProjectTasks((prev) => {
        const next = [...prev];
        const i = next.findIndex((t) => t._id === task._id);
        const j = next.findIndex((t) => t._id === other._id);
        if (i >= 0 && j >= 0) [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return <Loader message="Loading project..." />;
  }

  if (isNew) {
    const backLink = parentIdFromUrl ? `/tasks/projects/${parentIdFromUrl}` : '/tasks?tab=projects';
    return (
      <div className="max-w-xl mx-auto">
        <Link to={backLink} className="text-sm text-slate-600 hover:text-emerald-600 mb-4 inline-block">
          ← {parentIdFromUrl ? `Back to ${parentProject?.name || 'Parent Project'}` : 'Back to Task Manager'}
        </Link>
        {parentChain.length > 0 && (
          <nav className="flex items-center gap-1 text-sm text-slate-500 mb-4 flex-wrap">
            <Link to="/tasks?tab=projects" className="hover:text-emerald-600">Projects</Link>
            {parentChain.map((p, idx) => (
              <span key={p._id} className="flex items-center gap-1">
                <span>/</span>
                <Link to={`/tasks/projects/${p._id}`} className="hover:text-emerald-600">{p.name}</Link>
              </span>
            ))}
            <span>/</span>
            <span className="text-slate-700 font-medium">New Sub-Project</span>
          </nav>
        )}
        <h1 className="text-2xl font-bold text-slate-800 mb-4">
          {parentIdFromUrl ? 'New Sub-Project' : 'New Project'}
        </h1>
        {parentProject && (
          <p className="text-sm text-slate-500 mb-4">
            Creating sub-project under: <span className="font-medium text-slate-700">{parentProject.name}</span>
          </p>
        )}
        <form onSubmit={handleCreateProject} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {parentIdFromUrl ? 'Create Sub-Project' : 'Create Project'}
            </button>
            <Link to={backLink} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    );
  }

  if (!project) return null;

  const completedCount = projectTasks.filter((t) => t.completed).length;
  const totalCount = projectTasks.length;
  const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  // Back link - go to parent project if it exists, otherwise to task manager (Projects tab)
  const backLink = parentChain.length > 0 ? `/tasks/projects/${parentChain[parentChain.length - 1]._id}` : '/tasks?tab=projects';
  const backLabel = parentChain.length > 0 ? `← Back to ${parentChain[parentChain.length - 1].name}` : '← Back to Task Manager';

  return (
    <div className="max-w-3xl mx-auto">
      <Link to={backLink} className="text-sm text-slate-600 hover:text-emerald-600 mb-4 inline-block">
        {backLabel}
      </Link>

      {/* Breadcrumbs */}
      {parentChain.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-slate-500 mb-4 flex-wrap">
          <Link to="/tasks?tab=projects" className="hover:text-emerald-600">Projects</Link>
          {parentChain.map((p) => (
            <span key={p._id} className="flex items-center gap-1">
              <span>/</span>
              <Link to={`/tasks/projects/${p._id}`} className="hover:text-emerald-600">{p.name}</Link>
            </span>
          ))}
          <span>/</span>
          <span className="text-slate-700 font-medium">{project.name}</span>
        </nav>
      )}

      <div className="mb-6">
        {editingName ? (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 font-semibold"
              autoFocus
            />
            <button
              type="button"
              onClick={handleUpdateProject}
              className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditingName(false); setNameInput(project.name); setDescriptionInput(project.description || ''); }}
              className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
              {project.description && (
                <p className="text-slate-500 mt-1">{project.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-sm text-slate-500 hover:text-emerald-600"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={toggleArchive}
                className="text-sm text-slate-500 hover:text-amber-600"
              >
                {project.archived ? 'Unarchive' : 'Archive'}
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                className="text-sm text-slate-500 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-600">
          <span className="font-medium text-emerald-600">{completedCount}</span> of <span className="font-medium">{totalCount}</span> tasks
        </span>
        <span className="text-lg font-bold text-emerald-600">{progressPct}%</span>
      </div>
      {totalCount > 0 && (
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Sub-Projects Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-700">Sub-Projects</h2>
          <Link
            to={`/tasks/projects/new?parentId=${project._id}`}
            className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-700"
          >
            + New Sub-Project
          </Link>
        </div>
        {subProjects.length > 0 ? (
          <div className="grid gap-2">
            {subProjects.map((sp) => {
              const spTotal = sp.totalTasks ?? 0;
              const spCompleted = sp.completedTasks ?? 0;
              const spPercent = spTotal ? Math.round((spCompleted / spTotal) * 100) : 0;
              return (
                <Link
                  key={sp._id}
                  to={`/tasks/projects/${sp._id}`}
                  className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3 hover:border-emerald-300 hover:shadow-sm transition-colors"
                >
                  <div>
                    <span className="font-medium text-slate-800">{sp.name}</span>
                    {sp.subProjectCount > 0 && (
                      <span className="ml-2 text-xs text-slate-400">({sp.subProjectCount} sub-project{sp.subProjectCount > 1 ? 's' : ''})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-600 font-medium">{spCompleted}/{spTotal}</span>
                    <span className="text-slate-500">{spPercent}%</span>
                    {spTotal > 0 && (
                      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${spPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No sub-projects yet.</p>
        )}
      </div>

      {/* Tasks Section */}
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-700">Tasks</h2>
      </div>
      <form onSubmit={handleAddTask} className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add a task to this project..."
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
        <input
          type="date"
          value={newTaskDueDate}
          onChange={(e) => setNewTaskDueDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm"
        />
        <input
          type="text"
          value={newTaskNotes}
          onChange={(e) => setNewTaskNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm w-32"
        />
        <button
          type="submit"
          disabled={adding || !newTaskTitle.trim()}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          Add task
        </button>
      </form>

      <ul className="space-y-2">
        {[...projectTasks]
          .sort((a, b) => {
            const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            if (aDue !== bDue) return aDue - bDue;
            return (a.order || 0) - (b.order || 0);
          })
          .map((task, sortIndex, sorted) => {
            const due = formatDueDate(task.dueDate);
            const isExpanded = expandedTaskId === task._id;
            const isEditing = editingTaskId === task._id;

            if (isEditing) {
              return (
                <li
                  key={task._id}
                  className="bg-white border border-emerald-300 rounded-lg overflow-hidden shadow-sm"
                >
                  <div className="p-4 space-y-3">
                    <input
                      type="text"
                      value={editTaskTitle}
                      onChange={(e) => setEditTaskTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                      placeholder="Task title"
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={editTaskPriority}
                        onChange={(e) => setEditTaskPriority(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <input
                        type="date"
                        value={editTaskDueDate}
                        onChange={(e) => setEditTaskDueDate(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm"
                      />
                      <input
                        type="text"
                        value={editTaskNotes}
                        onChange={(e) => setEditTaskNotes(e.target.value)}
                        placeholder="Notes (optional)"
                        className="flex-1 min-w-[120px] rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEditTask(task)}
                        disabled={!editTaskTitle.trim()}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditTask}
                        className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </li>
              );
            }

            return (
              <li
                key={task._id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleTask(task)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                      }`}
                  >
                    {task.completed && '✓'}
                  </button>
                  <span className={`flex-1 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                    {task.title}
                  </span>
                  {due && (
                    <span className={`text-xs ${due.className}`}>{due.label}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium}`}>
                    {PRIORITY_LABELS[task.priority] || 'Medium'}
                  </span>
                  {task.notes && (
                    <button
                      type="button"
                      onClick={() => setExpandedTaskId(isExpanded ? null : task._id)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                      title="Notes"
                    >
                      {isExpanded ? '▼' : '▶'} Note
                    </button>
                  )}
                  <div className="flex items-center gap-0">
                    <button
                      type="button"
                      onClick={() => moveTask(task, 'up')}
                      disabled={sortIndex === 0}
                      className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTask(task, 'down')}
                      disabled={sortIndex === sorted.length - 1}
                      className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEditTask(task)}
                    className="text-slate-400 hover:text-emerald-600 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTask(task)}
                    className="text-slate-400 hover:text-red-600 text-sm"
                  >
                    Delete
                  </button>
                </div>
                {isExpanded && task.notes && (
                  <div className="px-4 pb-3 pt-0 pl-12 text-sm text-slate-600 border-t border-slate-100">
                    {task.notes}
                  </div>
                )}
              </li>
            );
          })}
      </ul>
      {projectTasks.length === 0 && (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-slate-600 mb-2">No tasks yet.</p>
          <p className="text-sm text-slate-500">Add your first task above.</p>
        </div>
      )}
    </div>
  );
}
