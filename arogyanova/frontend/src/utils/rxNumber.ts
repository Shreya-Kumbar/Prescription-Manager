/** Short prescription number shown everywhere, e.g. #a5117604 (search accepts it with or without #). */
export const rxNo = (id?: string | null) => (id ? `#${id.replace(/-/g, '').slice(0, 8)}` : '');
