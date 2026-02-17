/**
 * user_content status values. Keep in sync with main feed filter (useMainFeed)
 * and publish flows (PublishToFeedButton, ContentEditor, Create).
 * When adding statuses, update this type and use the same constant for filtering.
 */
export type UserContentStatus = 'active' | 'draft' | 'scheduled';

export const CONTENT_STATUS_ACTIVE: UserContentStatus = 'active';
export const CONTENT_STATUS_DRAFT: UserContentStatus = 'draft';
export const CONTENT_STATUS_SCHEDULED: UserContentStatus = 'scheduled';

/** Status used to show content on the main feed; must match what publishers set when going live. */
export const MAIN_FEED_STATUS = CONTENT_STATUS_ACTIVE;
