export function toArticles(digest, category = null) {
  const normalizedCategory = category?.toLowerCase() || null;

  return digest.stories
    .filter((story) => {
      if (!normalizedCategory) {
        return true;
      }

      return story.category.toLowerCase() === normalizedCategory;
    })
    .map((story, index) => ({
      id: crypto.randomUUID(),
      title: story.headline,
      snippet: `${story.summary} ${story.why_it_matters}`.trim(),
      url: story.source_url,
      sourceName: story.source_name,
      sourceLogoURL: null,
      publishedAt: digest.generated_at,
      rank: index + 1,
      category: story.category
    }));
}
