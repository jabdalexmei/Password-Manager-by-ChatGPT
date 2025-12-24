import React, { useCallback, useMemo, useState } from 'react';
import LogIn from './features/LogIn/LogIn';
import ProfileCreate from './features/ProfileCreate/ProfileCreate';
import Startup from './features/Startup/Startup';
import Vault from './features/Vault/Vault';
import Workspace from './features/Workspace/Workspace';
import { ToasterProvider } from './components/Toaster';
import { ProfileMeta, loginVault, setActiveProfile } from './lib/tauri';

type View = 'workspace' | 'startup' | 'create' | 'login' | 'vault';

const App: React.FC = () => {
  const [view, setView] = useState<View>('workspace');
  const [activeProfile, setProfile] = useState<ProfileMeta | null>(null);

  const openProfile = useCallback(async (profile: ProfileMeta) => {
    setProfile(profile);
    await setActiveProfile(profile.id);
    if (profile.has_password) {
      setView('login');
    } else {
      await loginVault(profile.id, undefined);
      setView('vault');
    }
  }, []);

  const handleProfileCreated = useCallback(
    async (profile: ProfileMeta) => {
      await openProfile(profile);
    },
    [openProfile]
  );

  const content = useMemo(() => {
    switch (view) {
      case 'startup':
        return <Startup onCreate={() => setView('create')} onOpen={openProfile} />;
      case 'workspace':
        return (
          <Workspace
            onWorkspaceReady={() => {
              setProfile(null);
              setView('startup');
            }}
          />
        );
      case 'create':
        return (
          <ProfileCreate
            onCreated={() => setView('startup')}
            onBack={() => setView('startup')}
            onProfileCreated={handleProfileCreated}
          />
        );
      case 'login':
        return activeProfile ? (
          <LogIn
            profileId={activeProfile.id}
            profileName={activeProfile.name}
            hasPassword={activeProfile.has_password}
            onBack={() => setView('startup')}
            onSuccess={() => setView('vault')}
          />
        ) : null;
      case 'vault':
        return activeProfile ? (
          <Vault
            profileId={activeProfile.id}
            profileName={activeProfile.name}
            isPasswordless={!activeProfile.has_password}
            onLocked={() => {
              if (activeProfile.has_password) {
                setView('login');
              } else {
                setProfile(null);
                setView('startup');
              }
            }}
          />
        ) : null;
      default:
        return null;
    }
  }, [activeProfile, handleProfileCreated, openProfile, view]);

  return <ToasterProvider>{content}</ToasterProvider>;
};

export default App;
