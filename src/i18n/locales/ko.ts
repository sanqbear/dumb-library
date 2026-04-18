export default {
  common: {
    add: '추가',
    cancel: '취소',
    save: '저장',
    delete: '삭제',
    close: '닫기',
    remove: '제거',
    confirm: '확인',
    edit: '편집',
    apply: '적용',
    rescan: '다시 스캔',
    change: '변경',
    select: '선택'
  },
  header: {
    searchPlaceholder: '프로그램 검색...',
    addProgram: '프로그램 추가',
    addFromPC: 'PC에서 추가',
    addFromSteam: '스팀에서 추가',
    gridView: '그리드 보기',
    listView: '리스트 보기',
    darkMode: '다크 모드',
    lightMode: '라이트 모드',
    language: '언어',
    filter: '필터',
    provider: '제공자',
    allProviders: '모든 제공자',
    tags: '태그',
    selectTags: '태그 선택',
    clearFilters: '필터 초기화',
    sortRecent: '최신순',
    sortOldest: '오래된순',
    sortNameAsc: '이름순 (ㄱ-ㅎ)',
    sortNameDesc: '이름순 (ㅎ-ㄱ)'
  },
  library: {
    emptyTitle: '아직 프로그램이 없어요',
    emptyAction: '프로그램 추가 버튼으로 시작하세요',
    emptyFilteredTitle: '일치하는 결과가 없어요',
    emptyFilteredAction: '필터를 조정해 보세요'
  },
  listView: {
    columnTitle: 'Title',
    columnProvider: 'Provider',
    columnTags: 'Tags',
    columnActions: 'Actions'
  },
  cardMenu: {
    launch: '실행',
    edit: '편집',
    changeThumbnail: '썸네일 변경',
    delete: '삭제'
  },
  addDialog: {
    title: '프로그램 추가',
    titleLabel: '제목',
    titlePlaceholder: '프로그램 이름 입력',
    executablePath: '실행 파일 경로',
    executablePathPlaceholder: '실행 파일 선택',
    tagsLabel: '태그',
    selectImage: '파일에서 선택',
    imageUrl: '이미지 URL',
    fetchUrl: '가져오기',
    dropHere: '여기로 드래그',
    addedSuccess: '프로그램이 추가되었습니다',
    addFailed: '프로그램 추가에 실패했습니다',
    onlyImages: '이미지 파일만 지원합니다',
    urlFetchFailed: 'URL에서 이미지를 가져오지 못했습니다',
    imageReadFailed: '이미지를 읽지 못했습니다'
  },
  editDialog: {
    title: '프로그램 수정',
    thumbnailLabel: '썸네일 (600×900)',
    iconLabel: '아이콘 (256×256)',
    thumbnailCropTitle: '썸네일 크롭 (2:3)',
    iconCropTitle: '아이콘 크롭 (1:1)',
    reextractFromExe: '.exe에서 재추출',
    steamArtworkSelect: 'Steam 아트워크 선택',
    steamCoverRestore: '기본 커버로 복원',
    steamCacheIcon: 'Steam 캐시에서 가져오기',
    updatedSuccess: '프로그램이 수정되었습니다',
    updateFailed: '프로그램 수정에 실패했습니다',
    deleteConfirmTitle: '프로그램 삭제',
    deleteConfirmMessage: '"{title}"을(를) 삭제하시겠습니까? 되돌릴 수 없습니다.',
    deleted: '삭제되었습니다',
    deleteFailed: '삭제에 실패했습니다',
    iconExtracted: '아이콘을 추출했습니다',
    iconExtractFailed: '아이콘 추출에 실패했습니다',
    steamCoverRedownloaded: 'Steam 커버를 다시 받았습니다',
    steamCoverFailed: 'Steam 커버를 받지 못했습니다 (AppID 또는 네트워크 확인)',
    steamCacheIconFound: 'Steam 캐시에서 아이콘을 가져왔습니다',
    steamCacheIconNotFound: 'Steam 캐시에서 아이콘을 찾지 못했습니다'
  },
  steamDialog: {
    title: '스팀에서 추가',
    installedTab: '설치된 게임',
    manualTab: 'AppID로 추가',
    searchPlaceholder: '이름으로 검색',
    noGamesFound: "설치된 Steam 게임을 찾지 못했습니다. Steam이 설치되어 있지 않거나 라이브러리를 읽지 못했을 수 있습니다. 'AppID로 추가' 탭에서 수동으로 입력할 수 있습니다.",
    appIdLabel: 'AppID',
    appIdPlaceholder: '예: 730',
    nameLabel: '이름',
    namePlaceholder: '게임 이름',
    appIdHelp: 'AppID는 Steam 상점 URL에서 확인할 수 있습니다.',
    appIdExample: '예: store.steampowered.com/app/{example} → AppID는 {example}',
    countFormat: '{count}개',
    filteredCountFormat: '{filtered} / {total}',
    addedSuccess: 'Steam 게임이 추가되었습니다',
    addedNGames: '{n}개 게임이 추가되었습니다',
    partialAdded: '{added}/{requested}개 게임만 추가되었습니다',
    someMissingThumb: '{added}개 추가됨. {missing}개는 커버를 못 받았습니다. 편집에서 "Steam 커버 다시 받기"로 재시도할 수 있습니다.',
    addFailed: '추가 실패',
    previewTitle: '미리보기',
    previewTooltip: '미리보기: {name}'
  },
  cropDialog: {
    title: '이미지 크롭',
    notReady: '크롭 준비가 안 되었습니다',
    noResult: '크롭 결과를 얻지 못했습니다',
    encodeFailed: '이미지 인코딩 실패',
    processFailed: '크롭 처리 실패'
  },
  artworkDialog: {
    title: 'Steam 아트워크 선택',
    libraryCover: 'Library Cover',
    libraryHero: 'Library Hero',
    header: 'Header',
    capsule: 'Capsule',
    logo: 'Logo',
    unavailable: '해당 아트워크 없음',
    downloadFailed: '이미지 다운로드에 실패했습니다'
  },
  card: {
    launchSuccess: '{title} 실행 중',
    launchFailed: '프로그램 실행에 실패했습니다',
    thumbnailUpdated: '썸네일이 업데이트되었습니다',
    thumbnailUpdateFailed: '썸네일 업데이트에 실패했습니다'
  },
  providers: {
    local: '로컬 다운로드',
    steam: '스팀'
  },
  window: {
    minimize: '최소화',
    maximize: '최대화',
    close: '닫기'
  }
}
