export const pickApkAsset = (assets: any[] | undefined): string | undefined => {
  if (!assets || !assets.length) return undefined;

  const apkCandidates = assets.filter((a) => {
    if (!a?.name) return false;
    const name = String(a.name).toLowerCase();
    return name.endsWith('.apk') || name.includes('.apk');
  });

  if (apkCandidates.length === 0) {
    // fallback to content_type check (less common) or undefined
    const ctCandidate = assets.find((a) =>
      String(a?.content_type || '').toLowerCase().includes('android'),
    );

    return ctCandidate?.browser_download_url;
  }

  // Prefer a candidate explicitly targeting arm64 or universal builds when available
  const preferred = apkCandidates.find((a) => {
    const name = String(a.name).toLowerCase();
    return name.includes('arm64') || name.includes('universal') || name.includes('armv8');
  });

  const chosen = preferred || apkCandidates[0];
  return chosen?.browser_download_url;
};

export default pickApkAsset;
