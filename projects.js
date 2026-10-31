(() => {
  const openDialogs = new Set();
  let savedOverflow;

  function lockPage(dialog) {
    if (openDialogs.size === 0) {
      savedOverflow = {
        root: document.documentElement.style.overflow,
        body: document.body.style.overflow,
      };
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    openDialogs.add(dialog);
  }

  function unlockPage(dialog) {
    openDialogs.delete(dialog);
    if (openDialogs.size === 0 && savedOverflow) {
      document.documentElement.style.overflow = savedOverflow.root;
      document.body.style.overflow = savedOverflow.body;
      savedOverflow = null;
    }
  }

  // Native dialogs provide keyboard focus containment and Escape dismissal.
  document.querySelectorAll('.project[data-dialog]').forEach(card => {
    const dialog = document.getElementById(card.dataset.dialog);
    const trigger = card.querySelector('button[aria-haspopup="dialog"]');
    if (!(dialog instanceof HTMLDialogElement) || !trigger) return;

    card.addEventListener('click', event => {
      if (dialog.open || event.target.closest('a')) return;
      dialog.showModal();
      lockPage(dialog);
      dialog.scrollTop = 0;
      dialog.focus({ preventScroll: true });
    });

    function isBackdrop(event) {
      const rect = dialog.getBoundingClientRect();
      return event.target === dialog && (
        event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom
      );
    }

    let startedOnBackdrop = false;
    dialog.addEventListener('pointerdown', event => {
      startedOnBackdrop = isBackdrop(event);
    });
    dialog.addEventListener('pointercancel', () => { startedOnBackdrop = false; });
    dialog.addEventListener('click', event => {
      const close = event.target.closest('[data-close]');
      // Releasing a drag or text selection outside the panel must not dismiss it.
      if (close || (startedOnBackdrop && isBackdrop(event))) dialog.close();
      startedOnBackdrop = false;
    });
    dialog.addEventListener('close', () => {
      unlockPage(dialog);
      trigger.focus({ preventScroll: true });
    });
  });
})();
