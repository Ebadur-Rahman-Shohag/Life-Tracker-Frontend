import { createContext, useContext, useState, useCallback } from 'react';
import { projects as projectsApi } from '../api/client';

const ProjectsContext = createContext(null);
const LIST_PARAMS = { includeArchived: true, parentId: 'null' };
const ALL_PROJECTS_PARAMS = { includeArchived: true };

export function ProjectsProvider({ children }) {
    const [projects, setProjects] = useState([]);
    const [archivedProjects, setArchivedProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsLoaded, setProjectsLoaded] = useState(false);

    const [allProjects, setAllProjects] = useState([]);
    const [allProjectsLoading, setAllProjectsLoading] = useState(false);
    const [allProjectsLoaded, setAllProjectsLoaded] = useState(false);

    const fetchProjects = useCallback(async (force = false) => {
        setProjectsLoading(true);
        try {
            const data = force
                ? (await projectsApi.list(LIST_PARAMS)).data
                : await projectsApi.listCached(LIST_PARAMS);
            const active = data.filter((p) => !p.archived).reverse();
            setProjects(active);
            setArchivedProjects(data.filter((p) => p.archived).reverse());
            setProjectsLoaded(true);
        } catch (err) {
            console.error('Failed to load projects:', err);
        } finally {
            setProjectsLoading(false);
        }
    }, []);

    const fetchAllProjects = useCallback(async (force = false) => {
        setAllProjectsLoading(true);
        try {
            const data = force
                ? (await projectsApi.list(ALL_PROJECTS_PARAMS)).data
                : await projectsApi.listCached(ALL_PROJECTS_PARAMS);
            setAllProjects(Array.isArray(data) ? data : []);
            setAllProjectsLoaded(true);
        } catch (err) {
            console.error('Failed to load all projects:', err);
        } finally {
            setAllProjectsLoading(false);
        }
    }, []);

    const addOptimisticProject = useCallback((newProject) => {
        if (!newProject || newProject.parentId) return;
        setProjects((prev) =>
            prev.some((p) => p._id === newProject._id)
                ? prev
                : [...prev, { ...newProject, totalTasks: 0, completedTasks: 0, subProjectCount: 0 }]
        );
    }, []);

    const deleteProject = useCallback(async (projectId, isArchived = false) => {
        await projectsApi.delete(projectId);
        if (isArchived) {
            setArchivedProjects((prev) => prev.filter((p) => p._id !== projectId));
        } else {
            setProjects((prev) => prev.filter((p) => p._id !== projectId));
        }
        setAllProjects((prev) => prev.filter((p) => p._id !== projectId));
    }, []);

    return (
        <ProjectsContext.Provider
            value={{
                projects,
                setProjects,
                archivedProjects,
                setArchivedProjects,
                projectsLoading,
                setProjectsLoading,
                projectsLoaded,
                fetchProjects,
                allProjects,
                allProjectsLoading,
                allProjectsLoaded,
                fetchAllProjects,
                addOptimisticProject,
                deleteProject,
            }}
        >
            {children}
        </ProjectsContext.Provider>
    );
}

export function useProjects() {
    const ctx = useContext(ProjectsContext);
    if (!ctx) throw new Error('useProjects must be used within ProjectsProvider');
    return ctx;
}
