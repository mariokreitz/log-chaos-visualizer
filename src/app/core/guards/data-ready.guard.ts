import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FileParseService } from '../services/file-parse.service';

/**
 * Guard that ensures data is ready before activating the analyse route.
 * Prevents navigation freeze by checking if log entries are available.
 * Redirects to dashboard if no data is loaded.
 */
export const dataReadyGuard: CanActivateFn = () => {
  const fileParse = inject(FileParseService);
  const router = inject(Router);

  // Allow navigation if we have entries or if parsing is in progress
  const hasData = fileParse.allEntries().length > 0;
  const isParsing = fileParse.isParsing();

  if (hasData || isParsing) {
    return true;
  }

  // Redirect to dashboard if no data available
  router.navigate(['/']);
  return false;
};
