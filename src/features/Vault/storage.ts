import { DataCard, Folder } from "./types";

const FOLDERS_KEY = "vault_folders";
const DATACARDS_KEY = "vault_datacards";

function seedDataCards(): DataCard[] {
  const iso = new Date().toISOString();

  return [
    {
      id: "1",
      title: "Work Email",
      username: "alex@example.com",
      email: "alex@example.com",
      mobilePhone: "+1 (415) 222-1111",
      password: "password123",
      url: "https://mail.example.com",
      notes: "Auto-generated during migration.",
      folderId: "work",
      favorite: true,
      archived: false,
      createdAt: iso,
      updatedAt: iso,
    },
    {
      id: "2",
      title: "Bank",
      username: "alex-m",
      password: "qwerty",
      folderId: "work",
      favorite: false,
      archived: false,
      createdAt: iso,
      updatedAt: iso,
    },
    {
      id: "3",
      title: "Dev Server",
      username: "devops",
      password: "hunter2",
      folderId: "personal",
      favorite: false,
      archived: false,
      createdAt: iso,
      updatedAt: iso,
    },
  ];
}

export function loadFolders(profileId: string): Folder[] {
  const raw = localStorage.getItem(`${FOLDERS_KEY}_${profileId}`);
  if (!raw) {
    return [
      { id: "work", name: "Work" },
      { id: "personal", name: "Personal" },
    ];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistFolders(profileId: string, folders: Folder[]) {
  localStorage.setItem(`${FOLDERS_KEY}_${profileId}`, JSON.stringify(folders));
}

export function loadDataCards(profileId: string): DataCard[] {
  const key = `${DATACARDS_KEY}_${profileId}`;
  const raw = localStorage.getItem(key);

  if (!raw) {
    const seeded = seedDataCards();
    localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw);
    // Если localStorage уже содержит [], тоже подсеем демо,
    // иначе экран будет пустым и непонятным.
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = seedDataCards();
      localStorage.setItem(key, JSON.stringify(seeded));
      return seeded;
    }
    return parsed;
  } catch {
    const seeded = seedDataCards();
    localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }
}

export function persistDataCards(profileId: string, dataCards: DataCard[]) {
  localStorage.setItem(`${DATACARDS_KEY}_${profileId}`, JSON.stringify(dataCards));
}
