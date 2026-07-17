export const cx = (...xs:(string|false|null|undefined)[]) => xs.filter(Boolean).join(' ');
export async function fetcher<T=any>(url:string, init?:RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers:{ 'Content-Type':'application/json', ...(init?.headers||{}) } });
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || res.statusText);
  return res.json();
}
