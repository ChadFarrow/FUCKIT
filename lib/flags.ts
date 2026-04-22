// Feature flags. Function form keeps the env lookup dynamic (for tests / hot reload).

export const isV4VTagsEnabled = () => process.env.V4V_TAGS_ENABLED === 'true';
