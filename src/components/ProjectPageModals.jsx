import { memo, Suspense, lazy } from 'react';
import NoteDetailView from './NoteDetailView';
import ConfirmModal from './ConfirmModal';
import ReferenceFormModal from './ReferenceFormModal';

const NoteForm = lazy(() => import('./NoteForm'));

function NoteFormModalShell({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl p-8 flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-emerald-600 animate-spin"
          aria-hidden
        />
        <p className="text-sm text-slate-600">Loading editor…</p>
      </div>
    </div>
  );
}

function ProjectPageModals({
  referenceModalOpen,
  editingReference,
  closeReferenceModal,
  defaultReferenceProjectIds,
  referenceProjects,
  refetchProjectReferences,
  noteFormOpen,
  noteForForm,
  noteFormCategories,
  noteFormManagedCategories,
  noteFormCatalogReady,
  closeNoteForm,
  handleNoteFormSubmit,
  detailViewOpen,
  viewingNote,
  closeDetailView,
  openEditNote,
  onDeleteNote,
  onToggleFavoriteNote,
  onToggleArchiveNote,
  confirmModal,
}) {
  return (
    <>
      <ReferenceFormModal
        key={editingReference?._id || 'create'}
        open={referenceModalOpen}
        onClose={closeReferenceModal}
        mode={editingReference ? 'edit' : 'create'}
        initialReference={editingReference}
        defaultProjectIds={defaultReferenceProjectIds}
        projects={referenceProjects}
        onSuccess={refetchProjectReferences}
      />

      <Suspense fallback={<NoteFormModalShell open={noteFormOpen} onClose={closeNoteForm} />}>
        <NoteForm
          open={noteFormOpen}
          initialNote={noteForForm}
          categories={noteFormCategories}
          managedCategories={noteFormManagedCategories}
          projects={referenceProjects}
          catalogLoading={noteFormOpen && !noteFormCatalogReady}
          onClose={closeNoteForm}
          onSubmit={handleNoteFormSubmit}
        />
      </Suspense>

      <NoteDetailView
        open={detailViewOpen}
        note={viewingNote}
        managedCategories={noteFormCatalogReady ? noteFormManagedCategories : []}
        onClose={closeDetailView}
        onEdit={openEditNote}
        onDelete={onDeleteNote}
        onToggleFavorite={onToggleFavoriteNote}
        onToggleArchive={onToggleArchiveNote}
      />

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
    </>
  );
}

export default memo(ProjectPageModals);
