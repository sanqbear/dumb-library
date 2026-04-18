export default {
  common: {
    add: 'Add',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    close: 'Close',
    remove: 'Remove',
    confirm: 'Confirm',
    edit: 'Edit',
    apply: 'Apply',
    rescan: 'Rescan',
    change: 'Change',
    select: 'Select'
  },
  header: {
    searchPlaceholder: 'Search programs...',
    addProgram: 'Add Program',
    addFromPC: 'Add from PC',
    addFromSteam: 'Add from Steam',
    gridView: 'Grid view',
    listView: 'List view',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
    language: 'Language',
    filter: 'Filter',
    provider: 'Provider',
    allProviders: 'All providers',
    tags: 'Tags',
    selectTags: 'Select tags',
    clearFilters: 'Clear filters',
    sortRecent: 'Most recent',
    sortOldest: 'Oldest',
    sortNameAsc: 'Name (A-Z)',
    sortNameDesc: 'Name (Z-A)'
  },
  library: {
    emptyTitle: 'No programs yet',
    emptyAction: 'Get started with the Add Program button',
    emptyFilteredTitle: 'No matching results',
    emptyFilteredAction: 'Try adjusting your filters'
  },
  listView: {
    columnTitle: 'Title',
    columnProvider: 'Provider',
    columnTags: 'Tags',
    columnActions: 'Actions'
  },
  cardMenu: {
    launch: 'Launch',
    edit: 'Edit',
    changeThumbnail: 'Change thumbnail',
    delete: 'Delete'
  },
  addDialog: {
    title: 'Add Program',
    titleLabel: 'Title',
    titlePlaceholder: 'Enter program title',
    executablePath: 'Executable Path',
    executablePathPlaceholder: 'Select executable file',
    tagsLabel: 'Tags',
    selectImage: 'Select from file',
    imageUrl: 'Image URL',
    fetchUrl: 'Fetch',
    dropHere: 'Drop here',
    addedSuccess: 'Program added successfully',
    addFailed: 'Failed to add program',
    onlyImages: 'Only image files are supported',
    urlFetchFailed: 'Failed to fetch image from URL',
    imageReadFailed: 'Failed to read image'
  },
  editDialog: {
    title: 'Edit Program',
    thumbnailLabel: 'Thumbnail (600×900)',
    iconLabel: 'Icon (256×256)',
    thumbnailCropTitle: 'Crop thumbnail (2:3)',
    iconCropTitle: 'Crop icon (1:1)',
    reextractFromExe: 'Re-extract from .exe',
    steamArtworkSelect: 'Steam artwork',
    steamCoverRestore: 'Restore default cover',
    steamCacheIcon: 'From Steam cache',
    updatedSuccess: 'Program updated successfully',
    updateFailed: 'Failed to update program',
    deleteConfirmTitle: 'Delete Program',
    deleteConfirmMessage: 'Delete "{title}"? This cannot be undone.',
    deleted: 'Deleted',
    deleteFailed: 'Failed to delete',
    iconExtracted: 'Icon extracted',
    iconExtractFailed: 'Failed to extract icon',
    steamCoverRedownloaded: 'Steam cover re-downloaded',
    steamCoverFailed: 'Failed to fetch Steam cover (check AppID or network)',
    steamCacheIconFound: 'Icon loaded from Steam cache',
    steamCacheIconNotFound: 'No icon found in Steam cache'
  },
  steamDialog: {
    title: 'Add from Steam',
    installedTab: 'Installed games',
    manualTab: 'Add by AppID',
    searchPlaceholder: 'Search by name',
    noGamesFound: "No installed Steam games found. Steam may not be installed or the library couldn't be read. You can enter an AppID manually in the 'Add by AppID' tab.",
    appIdLabel: 'AppID',
    appIdPlaceholder: 'e.g. 730',
    nameLabel: 'Name',
    namePlaceholder: 'Game name',
    appIdHelp: 'The AppID can be found in the Steam store URL.',
    appIdExample: 'e.g. store.steampowered.com/app/{example} → AppID is {example}',
    countFormat: '{count} games',
    filteredCountFormat: '{filtered} / {total}',
    addedSuccess: 'Steam game added',
    addedNGames: '{n} games added',
    partialAdded: 'Only {added}/{requested} games were added',
    someMissingThumb: '{added} added. {missing} could not get a cover. Retry in edit with "Restore default cover".',
    addFailed: 'Failed to add',
    previewTitle: 'Preview',
    previewTooltip: 'Preview: {name}'
  },
  cropDialog: {
    title: 'Crop image',
    notReady: 'Cropper not ready',
    noResult: 'Failed to get crop result',
    encodeFailed: 'Failed to encode image',
    processFailed: 'Crop processing failed'
  },
  artworkDialog: {
    title: 'Select Steam artwork',
    libraryCover: 'Library Cover',
    libraryHero: 'Library Hero',
    header: 'Header',
    capsule: 'Capsule',
    logo: 'Logo',
    unavailable: 'Artwork unavailable',
    downloadFailed: 'Image download failed'
  },
  card: {
    launchSuccess: 'Launching {title}',
    launchFailed: 'Failed to launch program',
    thumbnailUpdated: 'Thumbnail updated',
    thumbnailUpdateFailed: 'Failed to update thumbnail'
  },
  providers: {
    local: 'Local Download',
    steam: 'Steam'
  },
  window: {
    minimize: 'Minimize',
    maximize: 'Maximize',
    close: 'Close'
  }
}
