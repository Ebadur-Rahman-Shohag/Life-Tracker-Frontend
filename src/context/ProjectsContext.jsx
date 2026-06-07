import { createContext, useContext, useState, useCallback } from 'react';
import { projects as projectsApi } from '../api/client';

const ProjectsContext = createContext(null);

export function ProjectsProvider({ children }) {
    const [projects, setProjects] = useState([]);
    const [archivedProjects, setArchivedProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsLoaded, setProjectsLoaded] = useState(false);


    const fetchProjects = useCallback(async () => {
        setProjectsLoading(true);
        try {
            const { data } = await projectsApi.list({ includeArchived: true, parentId: 'null' });
            const active = data.filter((p) => !p.archived).reverse(); // oldest to newest
            setProjects(active);
            setArchivedProjects(data.filter((p) => p.archived).reverse());
            setProjectsLoaded(true);
        } catch (err) {
            console.error('Failed to load projects:', err);
        } finally {
            setProjectsLoading(false);
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

    // Delete project and update state
    const deleteProject = useCallback(async (projectId, isArchived = false) => {
        await projectsApi.delete(projectId);
        if (isArchived) {
            setArchivedProjects((prev) => prev.filter((p) => p._id !== projectId));
        } else {
            setProjects((prev) => prev.filter((p) => p._id !== projectId));
        }
    }, [setProjects, setArchivedProjects]);

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
