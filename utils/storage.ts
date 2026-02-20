export const getData = <T = any>(key: string): T => {
  if (typeof window === "undefined") return null as T;

  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

export const saveData = <T = any>(key: string, data: T): void => {
  if (typeof window === "undefined") return;

  localStorage.setItem(key, JSON.stringify(data));
};
