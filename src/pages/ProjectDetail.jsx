import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { projects as projectsApi, tasks as tasksApi, notes as notesApi, references as referencesApi, invalidateProjectsCache } from '../api/client';
import { buildCategoryList, fetchNoteFormCatalog } from '../lib/noteFormResources';
import { EMPTY_NOTE_DOC } from '../lib/noteTipTap';
import Loader from '../components/Loader';
import ProjectPageModals from '../components/ProjectPageModals';
import { useOptimisticTaskToggle } from '../hooks/useOptimisticTaskToggle';
import { useOptimisticTaskReorder } from '../hooks/useOptimisticTaskReorder';
import { useTaskListData } from '../hooks/useTaskListData';
import { sortTasks, reorderListToPosition } from '../lib/taskUtils';
import TaskPositionInput from '../components/TaskPositionInput';
import ProjectTaskList from '../components/ProjectTaskList';
import { useProjects } from '../context/ProjectsContext';

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
  const location = useLocation();
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
  const [addingTask, setAddingTask] = useState(false);
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

  const fetchProjectTasks = useCallback(async () => {
    const { data: proj } = await projectsApi.get(projectId);
    if (!proj) throw new Error('Project not found');
    setProject(proj);
    setNameInput(proj.name);
    setDescriptionInput(proj.description || '');
    setSubProjects(proj.subProjects || []);
    setParentChain(proj.parentChain || []);
    return proj.tasks || [];
  }, [projectId]);

  const {
    loadTasks,
    debouncedRefresh,
    markTogglePending,
    removeTogglePending,
  } = useTaskListData({
    fetchTasks: fetchProjectTasks,
    setTasks: setProjectTasks,
  });

  const debouncedRefreshWithProject = useCallback(() => {
    debouncedRefresh();
    invalidateProjectsCache();
  }, [debouncedRefresh]);

  const [projectNotes, setProjectNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [viewingNote, setViewingNote] = useState(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [includeSubProjectsNotes, setIncludeSubProjectsNotes] = useState(false);
  const [projectReferences, setProjectReferences] = useState([]);
  const [loadingProjectReferences, setLoadingProjectReferences] = useState(false);
  const [projectReferencesError, setProjectReferencesError] = useState(null);
  const [togglingFavoriteRefId, setTogglingFavoriteRefId] = useState(null);
  const [includeSubProjectsReferences, setIncludeSubProjectsReferences] = useState(false);
  const [referenceModalOpen, setReferenceModalOpen] = useState(false);
  const [editingReference, setEditingReference] = useState(null);
  const [referenceProjects, setReferenceProjects] = useState([]);

  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [noteForForm, setNoteForForm] = useState(null);
  const [noteFormStats, setNoteFormStats] = useState(null);
  const [noteFormManagedCategories, setNoteFormManagedCategories] = useState([]);
  const [noteFormCatalogReady, setNoteFormCatalogReady] = useState(false);
  const [noteFormError, setNoteFormError] = useState(null);
  const noteFormCatalogPromiseRef = useRef(null);

  const noteFormCategories = useMemo(
    () => buildCategoryList(noteFormManagedCategories, noteFormStats),
    [noteFormManagedCategories, noteFormStats]
  );

  const loadProjectNotesData = useCallback(async () => {
    const notesRes = await projectsApi.getNotes(projectId, { includeSubProjects: includeSubProjectsNotes });
    return notesRes.data || [];
  }, [projectId, includeSubProjectsNotes]);

  const refetchProjectNotes = useCallback(async () => {
    if (isNew || !projectId) return;
    try {
      setLoadingNotes(true);
      const data = await loadProjectNotesData();
      setProjectNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
      setProjectNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  }, [isNew, projectId, loadProjectNotesData]);

  const ensureNoteFormCatalog = useCallback(async () => {
    if (noteFormCatalogReady) return;
    if (noteFormCatalogPromiseRef.current) {
      return noteFormCatalogPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const { stats, managedCategories } = await fetchNoteFormCatalog(notesApi);
        setNoteFormStats(stats);
        setNoteFormManagedCategories(managedCategories);
        setNoteFormCatalogReady(true);
      } finally {
        noteFormCatalogPromiseRef.current = null;
      }
    })();

    noteFormCatalogPromiseRef.current = promise;
    return promise;
  }, [noteFormCatalogReady]);

  useEffect(() => {
    if (isNew) return;
    void import('../components/NoteForm');
    ensureNoteFormCatalog().catch((err) => {
      console.error('Failed to prefetch note form catalog:', err);
    });
  }, [isNew, ensureNoteFormCatalog]);

  const openAddNote = useCallback(() => {
    if (isNew || !projectId) return;
    setNoteFormError(null);
    setNoteForForm({
      projectIds: [projectId],
      title: '',
      blocks: EMPTY_NOTE_DOC,
      category: 'Uncategorized',
      isFavorite: false,
      tags: [],
    });
    setNoteFormOpen(true);
    ensureNoteFormCatalog().catch((err) => {
      console.error('Failed to load note form data:', err);
      setNoteFormError('Failed to load categories. Please try again.');
    });
  }, [isNew, projectId, ensureNoteFormCatalog]);

  const openEditNote = useCallback(
    async (note) => {
      setNoteFormError(null);
      setDetailViewOpen(false);
      setViewingNote(null);
      setNoteFormOpen(true);
      try {
        let full = note;
        if (!note.blocks || note.blocks.type !== 'doc') {
          const { data } = await notesApi.get(note._id);
          full = data;
        }
        setNoteForForm(full);
      } catch (err) {
        console.error('Failed to load note:', err);
        setNoteFormError('Failed to load note. Please try again.');
        setNoteFormOpen(false);
        return;
      }
      ensureNoteFormCatalog().catch((err) => {
        console.error('Failed to load note form data:', err);
        setNoteFormError('Failed to load categories. Please try again.');
      });
    },
    [ensureNoteFormCatalog]
  );

  const openProjectNoteDetail = useCallback(async (note) => {
    try {
      let full = note;
      if (!note.blocks || note.blocks.type !== 'doc') {
        const { data } = await notesApi.get(note._id);
        full = data;
      }
      setViewingNote(full);
      setDetailViewOpen(true);
    } catch (err) {
      console.error('Failed to load note:', err);
    }
  }, []);

  const closeDetailView = useCallback(() => {
    setDetailViewOpen(false);
    setViewingNote(null);
  }, []);

  const closeNoteForm = useCallback(() => {
    setNoteFormOpen(false);
    setNoteForForm(null);
    setNoteFormError(null);
  }, []);

  const handleNoteFormSubmit = useCallback(
    async (payload) => {
      if (!noteForForm) return;
      setNoteFormError(null);
      try {
        if (noteForForm._id) {
          await notesApi.update(noteForForm._id, payload);
        } else {
          await notesApi.create(payload);
        }
        closeNoteForm();
        await refetchProjectNotes();
      } catch (err) {
        const msg =
          err.response?.data?.errors?.[0]?.msg ||
          err.response?.data?.message ||
          (err instanceof Error ? err.message : 'Failed to save note.');
        setNoteFormError(msg);
      }
    },
    [noteForForm, closeNoteForm, refetchProjectNotes]
  );

  const openReferenceCreateModal = useCallback(() => {
    setEditingReference(null);
    setReferenceModalOpen(true);
  }, []);

  const openReferenceEditModal = useCallback((ref) => {
    setEditingReference(ref);
    setReferenceModalOpen(true);
  }, []);

  const closeReferenceModal = useCallback(() => {
    setReferenceModalOpen(false);
    setEditingReference(null);
  }, []);

  const handleDeleteReference = useCallback((ref) => {
    setConfirmModal({
      open: true,
      title: 'Delete reference?',
      message: `Remove "${ref.title}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      confirmLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: true } : null));
        try {
          await referencesApi.delete(ref._id);
          setProjectReferences((prev) => prev.filter((r) => r._id !== ref._id));
          setConfirmModal(null);
        } catch (err) {
          console.error('Failed to delete reference:', err);
          setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: false } : null));
          setProjectReferencesError('Failed to delete reference. Please try again.');
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  }, []);

  const handleDeleteNote = useCallback((note) => {
    setConfirmModal({
      open: true,
      title: 'Delete Note',
      message: `Are you sure you want to delete "${note.title}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      confirmLoading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: true } : null));
        try {
          await notesApi.delete(note._id);
          setProjectNotes((prev) => prev.filter((n) => n._id !== note._id));
          setDetailViewOpen(false);
          setViewingNote(null);
          setConfirmModal(null);
        } catch (err) {
          console.error('Failed to delete note:', err);
          setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: false } : null));
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  }, []);

  const handleToggleFavoriteNote = useCallback(async (note) => {
    const previous = note.isFavorite;
    setProjectNotes((prev) =>
      prev.map((n) => (n._id === note._id ? { ...n, isFavorite: !n.isFavorite } : n))
    );
    setViewingNote((current) =>
      current?._id === note._id ? { ...current, isFavorite: !current.isFavorite } : current
    );
    try {
      await notesApi.toggleFavorite(note._id);
    } catch (err) {
      setProjectNotes((prev) =>
        prev.map((n) => (n._id === note._id ? { ...n, isFavorite: previous } : n))
      );
      setViewingNote((current) =>
        current?._id === note._id ? { ...current, isFavorite: previous } : current
      );
      console.error('Failed to toggle favorite:', err);
    }
  }, []);

  const handleToggleArchiveNote = useCallback(async (note) => {
    setProjectNotes((prev) => prev.filter((n) => n._id !== note._id));
    setDetailViewOpen(false);
    setViewingNote(null);
    try {
      await notesApi.toggleArchive(note._id);
    } catch (err) {
      setProjectNotes((prev) => [...prev, note]);
      setViewingNote(note);
      setDetailViewOpen(true);
      console.error('Failed to toggle archive:', err);
    }
  }, []);
  const [confirmModal, setConfirmModal] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);

  // When projectId changes, show loading before paint so we do not render one frame of the previous
  // project (e.g. sub-project) while the URL already points at the parent — same <ProjectDetail> instance.
  useLayoutEffect(() => {
    if (isNew) return;
    setLoading(true);
  }, [projectId, isNew]);

  const defaultReferenceProjectIds = useMemo(
    () => (projectId && !isNew ? [projectId] : []),
    [projectId, isNew]
  );

  useEffect(() => {
    if (isNew) {
      setProject({ name: '', description: '' });
      setNameInput('');
      setDescriptionInput('');
      setProjectTasks([]);
      setSubProjects([]);
      setParentChain([]);
      setLoading(false);
      setAdding(false); // Reset adding state when entering new project form
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
    
    // Reset adding state when viewing an existing project
    setAdding(false);
    
    // Capture and clear navigation state (new sub-project created)
    const newSubProject = location.state?.newProject;
    if (newSubProject) {
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
    
    async function fetchProject() {
      try {
        await loadTasks(true);
        if (cancelled) return;
        if (newSubProject && newSubProject.parentId === projectId) {
          setSubProjects((prev) => {
            if (prev.some((sp) => sp._id === newSubProject._id)) return prev;
            return [
              ...prev,
              { ...newSubProject, totalTasks: 0, completedTasks: 0, subProjectCount: 0 },
            ];
          });
        }
      } catch {
        if (!cancelled) {
          // On error, at least show the new sub-project if we have one
          if (newSubProject && newSubProject.parentId === projectId) {
            setSubProjects([{ ...newSubProject, totalTasks: 0, completedTasks: 0, subProjectCount: 0 }]);
          }
          navigate('/tasks?tab=projects');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchProject();
    return () => { cancelled = true; };
  }, [projectId, isNew, navigate, parentIdFromUrl, location.pathname, location.search, loadTasks]);

  useEffect(() => {
    if (isNew && nameInputRef.current) nameInputRef.current.focus();
  }, [isNew]);

  // Load connected notes (same query as refetchProjectNotes, with unmount cancel)
  useEffect(() => {
    if (isNew || !projectId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingNotes(true);
        const data = await loadProjectNotesData();
        if (cancelled) return;
        setProjectNotes(data);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load notes:', err);
        setProjectNotes([]);
      } finally {
        if (!cancelled) setLoadingNotes(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, isNew, includeSubProjectsNotes, loadProjectNotesData]);

  useEffect(() => {
    if (isNew || !projectId) return;
    let cancelled = false;

    async function fetchReferences() {
      try {
        setLoadingProjectReferences(true);
        setProjectReferencesError(null);
        const res = await projectsApi.getReferences(projectId, {
          includeSubProjects: includeSubProjectsReferences,
        });
        if (!cancelled) {
          setProjectReferences(res.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load references:', err);
          setProjectReferencesError('Failed to load references. Please try again.');
          setProjectReferences([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingProjectReferences(false);
        }
      }
    }

    fetchReferences();
    return () => {
      cancelled = true;
    };
  }, [projectId, isNew, includeSubProjectsReferences]);

  const refetchProjectReferences = useCallback(async () => {
    if (isNew || !projectId) return;
    try {
      setLoadingProjectReferences(true);
      setProjectReferencesError(null);
      const res = await projectsApi.getReferences(projectId, {
        includeSubProjects: includeSubProjectsReferences,
      });
      setProjectReferences(res.data || []);
    } catch (err) {
      console.error('Failed to load references:', err);
      setProjectReferencesError('Failed to load references. Please try again.');
      setProjectReferences([]);
    } finally {
      setLoadingProjectReferences(false);
    }
  }, [projectId, isNew, includeSubProjectsReferences]);

  const { allProjects, allProjectsLoaded, fetchAllProjects } = useProjects();

  useEffect(() => {
    if (isNew) return;
    if (!allProjectsLoaded) {
      fetchAllProjects();
    }
  }, [isNew, allProjectsLoaded, fetchAllProjects]);

  useEffect(() => {
    if (!isNew) {
      setReferenceProjects(allProjects);
    }
  }, [isNew, allProjects]);

  async function handleCreateProject(e) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    setAdding(true);
    try {
      const payload = { name, description: descriptionInput.trim() };
      if (parentIdFromUrl) payload.parentId = parentIdFromUrl;
      const { data: newProject } = await projectsApi.create(payload);
      
      // Navigate back with the new project in state for optimistic display
      const destination = parentIdFromUrl ? `/tasks/projects/${parentIdFromUrl}` : '/tasks?tab=projects';
      // Don't reset adding state here - let the navigation handle cleanup
      navigate(destination, { replace: true, state: { newProject } });
    } catch (err) {
      console.error(err);
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

  function handleDeleteProject() {
    if (!project || isNew) return;
    const subCount = subProjects.length;
    const taskCount = projectTasks.length;
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
          await projectsApi.delete(project._id);
          const destination = parentChain.length > 0 ? `/tasks/projects/${parentChain[parentChain.length - 1]._id}` : '/tasks?tab=projects';
          navigate(destination);
          setConfirmModal(null);
        } catch (err) {
          console.error(err);
          setConfirmModal((prev) => (prev ? { ...prev, confirmLoading: false } : null));
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  }

  async function persistSubProjectReorder(reordered) {
    const snapshot = subProjects;
    setSubProjects(reordered);
    try {
      await projectsApi.reorder(reordered.map((sp) => sp._id));
    } catch (err) {
      setSubProjects(snapshot);
      console.error(err);
    }
  }

  function moveSubProject(subProjectId, direction) {
    const index = subProjects.findIndex((sp) => sp._id === subProjectId);
    if (index < 0) return;
    const reordered = reorderListToPosition(subProjects, subProjectId, index + 1 + direction);
    if (reordered) void persistSubProjectReorder(reordered);
  }

  function moveSubProjectToPosition(subProjectId, position) {
    const reordered = reorderListToPosition(subProjects, subProjectId, position);
    if (reordered) void persistSubProjectReorder(reordered);
  }

  async function handleAddTask(e) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || !project?._id) return;

    const savedPriority = newTaskPriority;
    const savedDueDate = newTaskDueDate;
    const savedNotes = newTaskNotes.trim();
    setAddingTask(true);
    setNewTaskTitle('');
    setNewTaskDueDate('');
    setNewTaskNotes('');

    const tempId = `temp-${Date.now()}`;
    const optimisticTask = {
      _id: tempId,
      title,
      projectId: project._id,
      priority: savedPriority,
      completed: false,
      dueDate: savedDueDate ? new Date(savedDueDate).toISOString() : undefined,
      notes: savedNotes || undefined,
      order: projectTasks.length,
    };
    setProjectTasks((prev) => [...prev, optimisticTask]);

    try {
      const payload = { title, projectId: project._id, priority: savedPriority };
      if (savedDueDate) payload.dueDate = new Date(savedDueDate).toISOString();
      if (savedNotes) payload.notes = savedNotes;
      const { data } = await tasksApi.create(payload);
      setProjectTasks((prev) => prev.map((t) => (t._id === tempId ? data : t)));
      invalidateProjectsCache();
    } catch (err) {
      setProjectTasks((prev) => prev.filter((t) => t._id !== tempId));
      setNewTaskTitle(title);
      setNewTaskDueDate(savedDueDate);
      setNewTaskNotes(savedNotes);
      console.error(err);
    } finally {
      setAddingTask(false);
    }
  }

  const toggleTask = useOptimisticTaskToggle({
    tasks: projectTasks,
    setTasks: setProjectTasks,
    apiToggle: (taskId) => tasksApi.toggle(taskId),
    getToggleDate: () => undefined,
    markTogglePending,
    removeTogglePending,
    debouncedRefresh: debouncedRefreshWithProject,
    onError: (err) => console.error('Failed to toggle task:', err),
  });
  const { moveTask, moveTaskToPosition } = useOptimisticTaskReorder({
    setTasks: setProjectTasks,
    sortTasks,
  });

  const sortedProjectTasks = useMemo(() => sortTasks(projectTasks), [projectTasks]);

  async function deleteTask(task) {
    const snapshot = projectTasks;
    setDeletingTaskId(task._id);
    setProjectTasks((prev) => prev.filter((t) => t._id !== task._id));
    try {
      await tasksApi.delete(task._id);
      invalidateProjectsCache();
    } catch (err) {
      setProjectTasks(snapshot);
      console.error(err);
    } finally {
      setDeletingTaskId(null);
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

    const payload = {
      title,
      priority: editTaskPriority,
      notes: editTaskNotes.trim(),
      dueDate: editTaskDueDate ? new Date(editTaskDueDate).toISOString() : null,
    };

    const optimisticTask = {
      ...task,
      title,
      priority: editTaskPriority,
      notes: editTaskNotes.trim(),
      dueDate: payload.dueDate,
    };

    const snapshot = projectTasks;
    setProjectTasks((prev) => prev.map((t) => (t._id === task._id ? optimisticTask : t)));
    cancelEditTask();

    try {
      const { data } = await tasksApi.update(task._id, payload);
      setProjectTasks((prev) => prev.map((t) => (t._id === task._id ? data : t)));
    } catch (err) {
      setProjectTasks(snapshot);
      console.error(err);
    }
  }

  if (loading) {
    return <Loader message="Loading project..." />;
  }

  if (isNew) {
    const backLink = parentIdFromUrl ? `/tasks/projects/${parentIdFromUrl}` : '/tasks?tab=projects';
    
    if (adding) {
      return <Loader message={`Creating ${parentIdFromUrl ? 'sub-project' : 'project'}...`} />;
    }
    
    return (
      <div className="w-full max-w-7xl mx-auto">
        <Link
          to={backLink}
          replace={!!parentIdFromUrl}
          className="text-sm text-slate-600 hover:text-emerald-600 mb-4 inline-block"
        >
          ← {parentIdFromUrl ? `Back to ${parentProject?.name || 'Parent Project'}` : 'Back to Task Manager'}
        </Link>
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
        <form onSubmit={handleCreateProject} className="max-w-xl bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
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
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700"
            >
              {parentIdFromUrl ? 'Create Sub-Project' : 'Create Project'}
            </button>
            <Link
              to={backLink}
              replace={!!parentIdFromUrl}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
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
    <div className="w-full max-w-7xl mx-auto">
      {noteFormError && (
        <div
          className="fixed top-4 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 shadow-lg flex items-start justify-between gap-2"
          role="alert"
        >
          <span className="min-w-0">{noteFormError}</span>
          <button
            type="button"
            onClick={() => setNoteFormError(null)}
            className="shrink-0 text-red-600 hover:text-red-800"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <Link
          to={backLink}
          replace={parentChain.length > 0}
          className="text-sm text-slate-600 hover:text-emerald-600 shrink-0"
        >
          {backLabel}
        </Link>
        {!editingName && (
          <div className="flex gap-2 shrink-0">
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
        )}
      </div>

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
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
            {project.description && (
              <p className="text-slate-500 mt-1">{project.description}</p>
            )}
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
            {subProjects.map((sp, index) => {
              const spTotal = sp.totalTasks ?? 0;
              const spCompleted = sp.completedTasks ?? 0;
              const spPercent = spTotal ? Math.round((spCompleted / spTotal) * 100) : 0;
              return (
                <div
                  key={sp._id}
                  className="relative flex items-stretch bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-emerald-300 hover:shadow-sm transition-colors"
                >
                  <Link
                    to={`/tasks/projects/${sp._id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`Open sub-project ${sp.name}`}
                  />
                  <div className="relative z-10 flex min-w-0 flex-1 items-center justify-between gap-2 p-3 pr-1 pointer-events-none">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800">{sp.name}</span>
                      {sp.subProjectCount > 0 && (
                        <span className="ml-2 text-xs text-slate-400">({sp.subProjectCount} sub-project{sp.subProjectCount > 1 ? 's' : ''})</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-sm">
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
                  </div>
                  <div className="relative z-10 flex items-center gap-0 self-stretch border-l border-slate-100 bg-white px-1 py-0.5 pointer-events-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        moveSubProject(sp._id, -1);
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
                        e.preventDefault();
                        e.stopPropagation();
                        moveSubProject(sp._id, 1);
                      }}
                      disabled={index === subProjects.length - 1}
                      className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <TaskPositionInput
                      position={index + 1}
                      max={subProjects.length}
                      onCommit={(pos) => moveSubProjectToPosition(sp._id, pos)}
                    />
                  </div>
                </div>
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
          disabled={addingTask || !newTaskTitle.trim()}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          Add task
        </button>
      </form>

      <ProjectTaskList
        tasks={sortedProjectTasks}
        expandedTaskId={expandedTaskId}
        onExpandedTaskIdChange={setExpandedTaskId}
        editingTaskId={editingTaskId}
        editTaskTitle={editTaskTitle}
        onEditTaskTitleChange={setEditTaskTitle}
        editTaskPriority={editTaskPriority}
        onEditTaskPriorityChange={setEditTaskPriority}
        editTaskDueDate={editTaskDueDate}
        onEditTaskDueDateChange={setEditTaskDueDate}
        editTaskNotes={editTaskNotes}
        onEditTaskNotesChange={setEditTaskNotes}
        onToggleTask={toggleTask}
        onMoveTask={moveTask}
        onMoveTaskToPosition={moveTaskToPosition}
        onDeleteTask={deleteTask}
        deletingTaskId={deletingTaskId}
        onStartEditTask={startEditTask}
        onCancelEditTask={cancelEditTask}
        onSaveEditTask={saveEditTask}
      />

      {/* Notes Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-slate-700">Connected Notes</h2>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeSubProjectsNotes}
                onChange={(e) => setIncludeSubProjectsNotes(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
              />
              Include sub-projects
            </label>
            <button
              type="button"
              onClick={openAddNote}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            >
              Add note
            </button>
            <Link
              to="/notes"
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Open Notes
            </Link>
          </div>
        </div>
        {loadingNotes ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-slate-500">Loading notes...</p>
          </div>
        ) : projectNotes.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-slate-600 mb-2">No notes connected to this project.</p>
            <p className="text-sm text-slate-500 mb-4">Create a note here or from the Notes page. This project will be linked automatically.</p>
            <button
              type="button"
              onClick={openAddNote}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            >
              Add note
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projectNotes.map((note) => {
              const preview = (note.searchText || note.content || '').trim();
              return (
              <div
                key={note._id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
                onClick={() => openProjectNoteDetail(note)}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-slate-800 truncate min-w-0">{note.title}</h3>
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => openEditNote(note)}
                      className="text-sm text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded-lg hover:bg-emerald-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note)}
                      className="text-sm text-slate-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
                </p>
                {preview && (
                  <p className="text-sm text-slate-600 mb-2 line-clamp-2">{preview}</p>
                )}
                {note.category && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
                    {note.category}
                  </span>
                )}
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* References Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-slate-700">Connected References</h2>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeSubProjectsReferences}
                onChange={(e) => setIncludeSubProjectsReferences(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
              />
              Include sub-projects
            </label>
            <button
              type="button"
              onClick={openReferenceCreateModal}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            >
              Add reference
            </button>
            <Link
              to="/references"
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Open References
            </Link>
          </div>
        </div>
        {loadingProjectReferences ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-slate-500">Loading references…</p>
          </div>
        ) : projectReferencesError ? (
          <div className="text-center py-8 bg-red-50 rounded-xl border border-red-200">
            <p className="text-red-800 mb-3">{projectReferencesError}</p>
            <button
              type="button"
              onClick={() => void refetchProjectReferences()}
              className="px-4 py-2 rounded-lg border border-red-300 text-red-800 hover:bg-red-100 text-sm font-medium"
            >
              Retry
            </button>
          </div>
        ) : projectReferences.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-slate-600 mb-2">No references connected to this project yet.</p>
            <p className="text-sm text-slate-500 mb-4">
              Add a reference here (it will link to this project), or from the References page and attach projects there.
            </p>
            <button
              type="button"
              onClick={openReferenceCreateModal}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            >
              Add reference
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {projectReferences.map((ref) => (
              <li
                key={ref._id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="min-w-0">
                  <h3 className="font-medium text-slate-800 break-words">{ref.title}</h3>
                  {ref.url ? (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-emerald-700 hover:underline break-all"
                    >
                      {ref.url}
                    </a>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={togglingFavoriteRefId === ref._id}
                    onClick={async () => {
                      if (togglingFavoriteRefId === ref._id) return;
                      const previous = ref.isFavorite;
                      setTogglingFavoriteRefId(ref._id);
                      setProjectReferences((prev) =>
                        prev.map((r) =>
                          r._id === ref._id ? { ...r, isFavorite: !r.isFavorite } : r
                        )
                      );
                      try {
                        await referencesApi.update(ref._id, { isFavorite: !previous });
                      } catch (e) {
                        setProjectReferences((prev) =>
                          prev.map((r) =>
                            r._id === ref._id ? { ...r, isFavorite: previous } : r
                          )
                        );
                        setProjectReferencesError('Failed to update favorite.');
                        console.error(e);
                      } finally {
                        setTogglingFavoriteRefId(null);
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-sm border disabled:opacity-50 ${
                      ref.isFavorite
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}
                    aria-pressed={!!ref.isFavorite}
                    aria-label={ref.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={() => openReferenceEditModal(ref)}
                    className="text-sm text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded-lg hover:bg-emerald-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteReference(ref)}
                    className="text-sm text-slate-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProjectPageModals
        referenceModalOpen={referenceModalOpen}
        editingReference={editingReference}
        closeReferenceModal={closeReferenceModal}
        defaultReferenceProjectIds={defaultReferenceProjectIds}
        referenceProjects={referenceProjects}
        refetchProjectReferences={refetchProjectReferences}
        noteFormOpen={noteFormOpen}
        noteForForm={noteForForm}
        noteFormCategories={noteFormCategories}
        noteFormManagedCategories={noteFormManagedCategories}
        noteFormCatalogReady={noteFormCatalogReady}
        closeNoteForm={closeNoteForm}
        handleNoteFormSubmit={handleNoteFormSubmit}
        detailViewOpen={detailViewOpen}
        viewingNote={viewingNote}
        closeDetailView={closeDetailView}
        openEditNote={openEditNote}
        onDeleteNote={handleDeleteNote}
        onToggleFavoriteNote={handleToggleFavoriteNote}
        onToggleArchiveNote={handleToggleArchiveNote}
        confirmModal={confirmModal}
      />
    </div>
  );
}
