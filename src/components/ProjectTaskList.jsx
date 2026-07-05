import { memo } from 'react';
import TaskPositionInput from './TaskPositionInput';
import ButtonSpinner from './ButtonSpinner';

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

function ProjectTaskList({
  tasks,
  expandedTaskId,
  onExpandedTaskIdChange,
  editingTaskId,
  editTaskTitle,
  onEditTaskTitleChange,
  editTaskPriority,
  onEditTaskPriorityChange,
  editTaskDueDate,
  onEditTaskDueDateChange,
  editTaskNotes,
  onEditTaskNotesChange,
  onToggleTask,
  onMoveTask,
  onMoveTaskToPosition,
  onDeleteTask,
  deletingTaskId,
  onStartEditTask,
  onCancelEditTask,
  onSaveEditTask,
}) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-slate-600 mb-2">No tasks yet.</p>
        <p className="text-sm text-slate-500">Add your first task above.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task, sortIndex) => {
        const due = formatDueDate(task.dueDate);
        const isExpanded = expandedTaskId === task._id;
        const isEditing = editingTaskId === task._id;

        if (isEditing) {
          return (
            <li
              key={task._id}
              className="bg-white border border-emerald-300 rounded-lg overflow-hidden shadow-sm"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSaveEditTask(task);
                }}
                className="p-4 space-y-3"
              >
                <input
                  type="text"
                  value={editTaskTitle}
                  onChange={(e) => onEditTaskTitleChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                  placeholder="Task title"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    value={editTaskPriority}
                    onChange={(e) => onEditTaskPriorityChange(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <input
                    type="date"
                    value={editTaskDueDate}
                    onChange={(e) => onEditTaskDueDateChange(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm"
                  />
                  <input
                    type="text"
                    value={editTaskNotes}
                    onChange={(e) => onEditTaskNotesChange(e.target.value)}
                    placeholder="Notes (optional)"
                    className="flex-1 min-w-[120px] rounded-lg border border-slate-300 px-3 py-2 text-slate-800 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!editTaskTitle.trim()}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEditTask}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
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
                onClick={() => onToggleTask(task)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
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
                  onClick={() => onExpandedTaskIdChange(isExpanded ? null : task._id)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                  title="Notes"
                >
                  {isExpanded ? '▼' : '▶'} Note
                </button>
              )}
              <div className="flex items-center gap-0">
                <button
                  type="button"
                  onClick={() => onMoveTask(task, 'up')}
                  disabled={sortIndex === 0}
                  className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoveTask(task, 'down')}
                  disabled={sortIndex === tasks.length - 1}
                  className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                  title="Move down"
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                onClick={() => onStartEditTask(task)}
                className="text-slate-400 hover:text-emerald-600 text-sm"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDeleteTask(task)}
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
                position={sortIndex + 1}
                max={tasks.length}
                onCommit={(pos) => onMoveTaskToPosition(task, pos)}
              />
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
  );
}

export default memo(ProjectTaskList);
