import { useEffect, useState, useMemo } from 'react';
import { projects as projectsApi } from '../api/client';

function buildProjectHierarchy(projects) {
  const projectMap = new Map();
  const rootProjects = [];

  // First pass: create map of all projects
  projects.forEach((project) => {
    projectMap.set(project._id, { ...project, children: [] });
  });

  // Second pass: build hierarchy
  projects.forEach((project) => {
    const node = projectMap.get(project._id);
    if (project.parentId) {
      const parent = projectMap.get(project.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        rootProjects.push(node);
      }
    } else {
      rootProjects.push(node);
    }
  });

  return rootProjects;
}

function ProjectOption({ project, level = 0, selected, onToggle, searchTerm }) {
  const matchesSearch = !searchTerm || project.name.toLowerCase().includes(searchTerm.toLowerCase());
  const hasMatchingChildren = project.children?.some((child) => {
    const childMatches = !searchTerm || child.name.toLowerCase().includes(searchTerm.toLowerCase());
    return childMatches || child.children?.some((grandchild) => 
      !searchTerm || grandchild.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (!matchesSearch && !hasMatchingChildren) {
    return null;
  }

  const isSelected = selected.includes(project._id);
  const indent = level * 20;

  return (
    <div>
      <label
        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer rounded-lg"
        style={{ paddingLeft: `${indent + 12}px` }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(project._id)}
          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
        />
        <span className="text-sm text-slate-700 flex-1">{project.name}</span>
        {project.subProjectCount > 0 && (
          <span className="text-xs text-slate-400">({project.subProjectCount} sub)</span>
        )}
      </label>
      {project.children && project.children.length > 0 && (
        <div>
          {project.children.map((child) => (
            <ProjectOption
              key={child._id}
              project={child}
              level={level + 1}
              selected={selected}
              onToggle={onToggle}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectSelector({ selected = [], onChange, onClose }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadProjects() {
      try {
        const { data } = await projectsApi.list({ includeArchived: true });
        setProjects(data || []);
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  const hierarchy = useMemo(() => buildProjectHierarchy(projects), [projects]);

  function handleToggle(projectId) {
    const newSelected = selected.includes(projectId)
      ? selected.filter((id) => id !== projectId)
      : [...selected, projectId];
    onChange(newSelected);
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-slate-500">
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-lg max-h-96 flex flex-col">
      <div className="p-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">Select Projects</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search projects..."
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {hierarchy.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <p>No projects found.</p>
            <p className="text-xs mt-1">Create a project first.</p>
          </div>
        ) : (
          <div>
            {hierarchy.map((project) => (
              <ProjectOption
                key={project._id}
                project={project}
                selected={selected}
                onToggle={handleToggle}
                searchTerm={searchTerm}
              />
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-600 mb-2">
            {selected.length} project{selected.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}
    </div>
  );
}
