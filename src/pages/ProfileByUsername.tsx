import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProfileByUsername } from '@/services/profile.service';
import { PublicProfile } from '@/components/PublicProfile';
import { Loader2 } from 'lucide-react';

/**
 * Full-page profile view at /profile/:username.
 * Resolves username to profile and renders PublicProfile; on close, navigates back.
 */
export default function ProfileByUsername() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username?.trim()) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    getProfileByUsername(username.trim())
      .then((profile) => {
        if (cancelled) return;
        if (profile) {
          setUserId(profile.user_id);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  const handleClose = () => {
    navigate(-1);
    if (window.history.length <= 1) navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (notFound || !userId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <h1 className="text-2xl font-bold mb-2">Profile not found</h1>
        <p className="text-muted-foreground mb-6 text-center">
          @{username} doesn&apos;t exist or the link may be broken.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
        >
          Go home
        </button>
      </div>
    );
  }

  return (
    <PublicProfile
      userId={userId}
      isOpen
      onClose={handleClose}
      onMessage={(id) => {
        handleClose();
        navigate('/messages');
        // Optional: open conversation with id
      }}
    />
  );
}
