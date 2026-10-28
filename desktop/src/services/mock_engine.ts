import {
  ScanResponse,
  ScanProgressEvent,
  CleanPayload,
  CleanResponse,
  CleanProgressEvent,
  AppsListResponse,
  UninstallPayload,
  SpaceLensResponse,
  InstalledApp,
  SpaceLensNode,
  OrphanAppGroup,
  OrphansResponse,
} from '../types';

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockScan(
  onProgress?: (event: ScanProgressEvent) => void,
  shouldCancel?: () => boolean
): Promise<ScanResponse> {
  const categories: ScanResponse['categories'] = [
    { category: 'system_junk', title: 'System Junk', description: 'System caches, logs, and temporary files',
      total_bytes: 516100000, item_count: 1, items: [{ id: 'system-log', path: '~/Library/Logs/example', name: 'example', size_bytes: 516100000, category: 'system_junk', requires_admin: false, deletion_method: 'remove_item', is_selected_by_default: true }] },
    { category: 'user_caches', title: 'User Cache', description: 'Application caches and browser data',
      total_bytes: 710000, item_count: 1, items: [{ id: 'user-cache', path: '~/Library/Caches/example', name: 'example', size_bytes: 710000, category: 'user_caches', requires_admin: false, deletion_method: 'remove_item', is_selected_by_default: true }] },
    { category: 'node_cache', title: 'Node Cache', description: 'npm, yarn, and pnpm download caches',
      total_bytes: 310000000, item_count: 1, items: [{ id: 'node-cache', path: '~/.npm', name: 'npm cache', size_bytes: 310000000, category: 'node_cache', requires_admin: false, deletion_method: 'remove_item', is_selected_by_default: true }] },
    { category: 'large_files', title: 'Large & Old Files', description: 'Files over 100 MB or older than 1 year',
      total_bytes: 700600000, item_count: 1, items: [{ id: 'large-file', path: '~/Downloads/example.zip', name: 'example.zip', size_bytes: 700600000, category: 'large_files', requires_admin: false, deletion_method: 'trash', is_selected_by_default: false }] },
    { category: 'ai_apps', title: 'AI Apps', description: 'Local AI app logs, caches, and optional history',
      total_bytes: 5000000, item_count: 2, items: [
        { id: 'ai-log', path: '~/.ollama/logs', name: 'Ollama Logs', size_bytes: 1000000, category: 'ai_apps', requires_admin: false, deletion_method: 'remove_item', is_selected_by_default: true },
        { id: 'ai-history', path: '~/.ollama/history', name: 'Ollama CLI Prompt History (Optional)', size_bytes: 4000000, category: 'ai_apps', requires_admin: false, deletion_method: 'trash', is_selected_by_default: false },
      ] },
  ];
  let scannedBytes = 0;
  for (const [index, category] of categories.entries()) {
    if (shouldCancel?.()) throw new Error('Đã hủy quét');
    scannedBytes += category.total_bytes;
    onProgress?.({ current_category: category.title, current_path: category.items[0].path,
      progress_fraction: (index + 1) / categories.length, scanned_bytes: scannedBytes });
    await delay(200);
  }
  return { scan_id: `preview_${Date.now()}`, duration_ms: 1000, categories,
    total_cleanable_bytes: scannedBytes, fda_limited_categories: [] };
}

export async function mockClean(
  payload: CleanPayload,
  onProgress?: (event: CleanProgressEvent) => void
): Promise<CleanResponse> {
  let freed = 0;
  let trashed = 0;

  for (let i = 0; i < payload.targets.length; i++) {
    const target = payload.targets[i];
    const itemBytes = 250000000; // Ước tính
    if (target.deletion_method === 'trash') {
      trashed += itemBytes;
    } else {
      freed += itemBytes;
    }
    if (onProgress) {
      onProgress({
        current_item: target.path,
        progress_fraction: (i + 1) / payload.targets.length,
        trashed_bytes: trashed,
        freed_bytes: freed,
      });
    }
    await delay(120);
  }

  return {
    permanently_freed_bytes: freed,
    trashed_bytes: trashed,
    total_affected_bytes: freed + trashed,
    success_count: payload.targets.length,
    failure_count: 0,
    duration_ms: 1200,
    details: payload.targets.map((t) => ({
      path: t.path,
      status: 'success',
      affected_bytes: 250000000,
      method_used: t.deletion_method,
    })),
  };
}

export async function mockGetInstalledApps(): Promise<AppsListResponse> {
  const apps: InstalledApp[] = [
    {
      id: 'app_docker',
      name: 'Docker Desktop',
      bundle_id: 'com.docker.docker',
      version: '4.35.0',
      bundle_path: '/Applications/Docker.app',
      architectures: ['arm64'],
      total_size_bytes: 12420000000,
      is_system_protected: false,
      is_self_app: false,
      associated_files: [
        {
          path: '/Applications/Docker.app',
          file_type: 'bundle',
          size_bytes: 3820000000,
          is_essential: true,
          deletion_method: 'trash',
        },
        {
          path: '~/Library/Containers/com.docker.docker',
          file_type: 'app_support',
          size_bytes: 8120000000,
          is_essential: false,
          deletion_method: 'trash',
        },
        {
          path: '~/Library/Caches/com.docker.docker',
          file_type: 'cache',
          size_bytes: 460000000,
          is_essential: false,
          deletion_method: 'trash',
        },
        {
          path: '~/Library/Preferences/com.docker.docker.plist',
          file_type: 'preferences',
          size_bytes: 20000000,
          is_essential: false,
          deletion_method: 'trash',
        },
      ],
    },
    {
      id: 'app_figma',
      name: 'Figma',
      bundle_id: 'com.figma.Desktop',
      version: '116.15.4',
      bundle_path: '/Applications/Figma.app',
      architectures: ['arm64'],
      total_size_bytes: 2150000000,
      is_system_protected: false,
      is_self_app: false,
      associated_files: [
        {
          path: '/Applications/Figma.app',
          file_type: 'bundle',
          size_bytes: 1200000000,
          is_essential: true,
          deletion_method: 'trash',
        },
        {
          path: '~/Library/Application Support/Figma',
          file_type: 'app_support',
          size_bytes: 650000000,
          is_essential: false,
          deletion_method: 'trash',
        },
        {
          path: '~/Library/Caches/com.figma.Desktop',
          file_type: 'cache',
          size_bytes: 300000000,
          is_essential: false,
          deletion_method: 'trash',
        },
      ],
    },
    {
      id: 'app_spotify',
      name: 'Spotify',
      bundle_id: 'com.spotify.client',
      version: '1.2.40',
      bundle_path: '/Applications/Spotify.app',
      architectures: ['arm64', 'x86_64'],
      total_size_bytes: 1450000000,
      is_system_protected: false,
      is_self_app: false,
      associated_files: [
        {
          path: '/Applications/Spotify.app',
          file_type: 'bundle',
          size_bytes: 420000000,
          is_essential: true,
          deletion_method: 'trash',
        },
        {
          path: '~/Library/Application Support/Spotify',
          file_type: 'app_support',
          size_bytes: 630000000,
          is_essential: false,
          deletion_method: 'trash',
        },
        {
          path: '~/Library/Caches/com.spotify.client',
          file_type: 'cache',
          size_bytes: 400000000,
          is_essential: false,
          deletion_method: 'trash',
        },
      ],
    },
    {
      id: 'app_safari',
      name: 'Safari',
      bundle_id: 'com.apple.Safari',
      version: '18.1',
      bundle_path: '/Applications/Safari.app',
      architectures: ['arm64'],
      total_size_bytes: 48000000,
      is_system_protected: true, // SIP Khóa
      is_self_app: false,
      associated_files: [
        {
          path: '/Applications/Safari.app',
          file_type: 'bundle',
          size_bytes: 48000000,
          is_essential: true,
          deletion_method: 'trash',
        },
      ],
    },
    {
      id: 'app_vxclean',
      name: 'VXClean',
      bundle_id: 'local.vxclean.app',
      version: '1.0.4',
      bundle_path: '/Applications/VXClean.app',
      architectures: ['arm64'],
      total_size_bytes: 32000000,
      is_system_protected: false,
      is_self_app: true, // Ứng dụng tự thân khóa
      associated_files: [
        {
          path: '/Applications/VXClean.app',
          file_type: 'bundle',
          size_bytes: 32000000,
          is_essential: true,
          deletion_method: 'trash',
        },
      ],
    },
  ];

  return { apps, total_apps: apps.length };
}

export async function mockUninstallApp(payload: UninstallPayload): Promise<CleanResponse> {
  await delay(800);
  return {
    permanently_freed_bytes: payload.allow_admin_fallback ? 40000000 : 0,
    trashed_bytes: 2500000000,
    total_affected_bytes: 2540000000,
    success_count: payload.selected_paths.length,
    failure_count: 0,
    duration_ms: 800,
    details: payload.selected_paths.map((p) => ({
      path: p,
      status: 'success',
      affected_bytes: 500000000,
      method_used: 'trash',
    })),
  };
}

export async function mockAnalyzeSpaceLens(targetPath: string): Promise<SpaceLensResponse> {
  await delay(600);
  const rootNode: SpaceLensNode = {
    name: 'Projects',
    path: targetPath,
    size_bytes: 28400000000,
    is_directory: true,
    is_package: false,
    is_access_denied: false,
    children: [
      {
        name: 'vxclean',
        path: `${targetPath}/vxclean`,
        size_bytes: 14200000000,
        is_directory: true,
        is_package: false,
        is_access_denied: false,
        children: [
          {
            name: 'target',
            path: `${targetPath}/vxclean/desktop/src_tauri/target`,
            size_bytes: 9800000000,
            is_directory: true,
            is_package: false,
            is_access_denied: false,
          },
          {
            name: 'node_modules',
            path: `${targetPath}/vxclean/desktop/node_modules`,
            size_bytes: 3200000000,
            is_directory: true,
            is_package: false,
            is_access_denied: false,
          },
          {
            name: 'VXClean.xcodeproj',
            path: `${targetPath}/vxclean/VXClean.xcodeproj`,
            size_bytes: 1200000000,
            is_directory: true,
            is_package: true,
            is_access_denied: false,
          },
        ],
      },
      {
        name: 'vxphotos',
        path: `${targetPath}/vxphotos`,
        size_bytes: 8400000000,
        is_directory: true,
        is_package: false,
        is_access_denied: false,
        children: [
          {
            name: 'target',
            path: `${targetPath}/vxphotos/src-tauri/target`,
            size_bytes: 6200000000,
            is_directory: true,
            is_package: false,
            is_access_denied: false,
          },
          {
            name: 'node_modules',
            path: `${targetPath}/vxphotos/node_modules`,
            size_bytes: 2200000000,
            is_directory: true,
            is_package: false,
            is_access_denied: false,
          },
        ],
      },
      {
        name: 'vxmedia',
        path: `${targetPath}/vxmedia`,
        size_bytes: 5800000000,
        is_directory: true,
        is_package: false,
        is_access_denied: false,
        children: [
          {
            name: 'target',
            path: `${targetPath}/vxmedia/src-tauri/target`,
            size_bytes: 4100000000,
            is_directory: true,
            is_package: false,
            is_access_denied: false,
          },
          {
            name: 'node_modules',
            path: `${targetPath}/vxmedia/node_modules`,
            size_bytes: 1700000000,
            is_directory: true,
            is_package: false,
            is_access_denied: false,
          },
        ],
      },
    ],
  };

  return {
    root_path: targetPath,
    total_analyzed_bytes: 28400000000,
    root_node: rootNode,
  };
}

export { formatBytes } from './byte_format';

export async function mockGetOrphans(): Promise<OrphansResponse> {
  await delay(500);
  const orphans: OrphanAppGroup[] = [
    {
      id: 'orphan_postman',
      original_app_name: 'Postman (Đã gỡ)',
      bundle_id_guess: 'com.postmanlabs.mac',
      last_modified: '12 ngày trước',
      total_size_bytes: 1840000000,
      items: [
        {
          id: 'postman_app_sup',
          path: '~/Library/Application Support/Postman',
          size_bytes: 1420000000,
          residual_type: 'app_support',
          is_safe_candidate: true,
        },
        {
          id: 'postman_caches',
          path: '~/Library/Caches/com.postmanlabs.mac',
          size_bytes: 420000000,
          residual_type: 'cache',
          is_safe_candidate: true,
        },
      ],
    },
    {
      id: 'orphan_zoom',
      original_app_name: 'Zoom.us (Đã gỡ)',
      bundle_id_guess: 'us.zoom.xos',
      last_modified: '24 ngày trước',
      total_size_bytes: 650000000,
      items: [
        {
          id: 'zoom_caches',
          path: '~/Library/Caches/us.zoom.xos',
          size_bytes: 520000000,
          residual_type: 'cache',
          is_safe_candidate: true,
        },
        {
          id: 'zoom_logs',
          path: '~/Library/Logs/zoom.us',
          size_bytes: 130000000,
          residual_type: 'logs',
          is_safe_candidate: true,
        },
      ],
    },
    {
      id: 'orphan_telegram',
      original_app_name: 'Telegram Desktop (Bản cũ)',
      bundle_id_guess: 'ru.keepcoder.Telegram',
      last_modified: '1 tháng trước',
      total_size_bytes: 2350000000,
      items: [
        {
          id: 'tele_cache',
          path: '~/Library/Group Containers/6N38VWS5BX.ru.keepcoder.Telegram/account-data',
          size_bytes: 2350000000,
          residual_type: 'app_support',
          is_safe_candidate: true,
        },
      ],
    },
  ];

  const total_bytes = orphans.reduce((sum, o) => sum + o.total_size_bytes, 0);
  const total_count = orphans.reduce((sum, o) => sum + o.items.length, 0);

  return {
    orphans,
    total_bytes,
    total_count,
  };
}

export async function mockCleanOrphans(selectedPaths: string[]): Promise<CleanResponse> {
  await delay(700);
  const totalBytes = 4840000000;
  return {
    permanently_freed_bytes: totalBytes,
    trashed_bytes: 0,
    total_affected_bytes: totalBytes,
    success_count: selectedPaths.length,
    failure_count: 0,
    duration_ms: 700,
    details: selectedPaths.map((p) => ({
      path: p,
      status: 'success',
      affected_bytes: Math.floor(totalBytes / (selectedPaths.length || 1)),
      method_used: 'remove_item',
    })),
  };
}
