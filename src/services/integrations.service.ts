import { supabase } from "@/integrations/supabase/client";

// ============= I1: Stripe Connect =============

export const stripeConnect = {
  /**
   * Start Stripe Connect onboarding for creator payouts
   * Returns a URL to redirect the user to
   */
  async startOnboarding(): Promise<{ url: string; accountId: string }> {
    const { data, error } = await supabase.functions.invoke("stripe-connect-onboard");
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Request a payout of iCoins to connected Stripe account
   * Minimum payout: 1000 iCoins = $1 USD
   */
  async requestPayout(amount: number): Promise<{ success: boolean; transferId: string; usdAmount: number }> {
    const { data, error } = await supabase.functions.invoke("stripe-connect-payout", {
      body: { amount },
    });
    if (error) throw new Error(error.message);
    return data;
  },
};

// ============= I2: Firebase Cloud Messaging =============

export const pushNotifications = {
  /**
   * Send push notification to specific user(s)
   */
  async sendToUsers(params: {
    userIds: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<{ success: boolean; sent: number }> {
    const { data, error } = await supabase.functions.invoke("send-push-notification", {
      body: params,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Send push notification to a topic (all subscribed users)
   */
  async sendToTopic(params: {
    topic: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<{ success: boolean }> {
    const { data, error } = await supabase.functions.invoke("send-push-notification", {
      body: params,
    });
    if (error) throw new Error(error.message);
    return data;
  },
};

// ============= I3: Cloudflare Stream =============

export const cloudflareStream = {
  /**
   * Get a direct upload URL for video content
   * Returns uploadUrl and videoId
   */
  async getUploadUrl(params?: {
    contentId?: string;
    maxDurationSeconds?: number;
  }): Promise<{ uploadUrl: string; videoId: string }> {
    const { data, error } = await supabase.functions.invoke("cloudflare-stream-upload", {
      body: params || {},
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Check video processing status and get playback URLs
   */
  async getVideoStatus(videoId: string): Promise<{
    videoId: string;
    status: string;
    readyToStream: boolean;
    playbackUrl: string | null;
    thumbnailUrl: string | null;
    duration: number;
  }> {
    const { data, error } = await supabase.functions.invoke("cloudflare-stream-status", {
      body: { videoId },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Upload a video file to Cloudflare Stream
   */
  async uploadVideo(
    file: File,
    contentId?: string,
    onProgress?: (progress: number) => void
  ): Promise<{ videoId: string; playbackUrl: string | null }> {
    // Get upload URL
    const { uploadUrl, videoId } = await this.getUploadUrl({ contentId });

    // Upload using tus or direct upload
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Poll for ready status
          let attempts = 0;
          while (attempts < 60) {
            const status = await this.getVideoStatus(videoId);
            if (status.readyToStream) {
              resolve({ videoId, playbackUrl: status.playbackUrl });
              return;
            }
            await new Promise((r) => setTimeout(r, 2000));
            attempts++;
          }
          resolve({ videoId, playbackUrl: null });
        } else {
          reject(new Error("Upload failed"));
        }
      };

      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.open("POST", uploadUrl);
      xhr.send(formData);
    });
  },
};

// ============= I4: Twilio SMS Verification =============

export const smsVerification = {
  /**
   * Send SMS verification code to phone number
   */
  async sendCode(phoneNumber: string): Promise<{ success: boolean; phoneNumber: string }> {
    const { data, error } = await supabase.functions.invoke("twilio-send-verification", {
      body: { phoneNumber },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Verify the SMS code
   */
  async verifyCode(code: string): Promise<{ success: boolean; phoneNumber: string }> {
    const { data, error } = await supabase.functions.invoke("twilio-verify-code", {
      body: { code },
    });
    if (error) throw new Error(error.message);
    return data;
  },
};

// ============= I5: AI Content Moderation =============

export const contentModeration = {
  /**
   * Moderate content using AI Vision
   */
  async moderate(params: {
    contentId?: string;
    mediaUrl?: string;
    caption?: string;
  }): Promise<{
    safe: boolean;
    categories: {
      nsfw: boolean;
      violence: boolean;
      hate: boolean;
      spam: boolean;
      copyright: boolean;
    };
    confidence: number;
    reasons: string[];
    action: "approved" | "flagged" | "rejected";
  }> {
    const { data, error } = await supabase.functions.invoke("ai-moderate-content", {
      body: params,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Preview moderation result without saving
   */
  async preview(mediaUrl: string, caption?: string) {
    return this.moderate({ contentId: "preview", mediaUrl, caption });
  },
};

// ============= I6: Analytics =============

export const analytics = {
  /**
   * Track a custom event
   */
  async track(
    eventType: string,
    properties?: Record<string, any>
  ): Promise<{ success: boolean }> {
    const { data, error } = await supabase.functions.invoke("track-analytics", {
      body: {
        eventType,
        properties,
        sessionId: sessionStorage.getItem("analytics_session_id"),
      },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Track content view
   */
  async trackContentView(contentId: string, properties?: {
    watchDuration?: number;
    completionRate?: number;
    attentionScore?: number;
    contentType?: string;
  }): Promise<void> {
    await this.track("content_view", { contentId, ...properties });
  },

  /**
   * Track content engagement (like, share, comment)
   */
  async trackEngagement(
    contentId: string,
    action: "like" | "share" | "comment" | "save",
    properties?: Record<string, any>
  ): Promise<void> {
    await this.track(`content_${action}`, { contentId, ...properties });
  },

  /**
   * Start a new analytics session
   */
  startSession(): void {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("analytics_session_id", sessionId);

    // Fire-and-forget; never crash the app if analytics tracking fails.
    void this.track("session_start", { sessionId }).catch((err) => {
      console.warn("[Analytics] Failed to start session", err);
    });
  },

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: {
    likedTags?: string[];
    dislikedTags?: string[];
    category?: string;
  }): Promise<void> {
    await this.track("preference_update", preferences);
  },
};

// Initialize analytics session on load
if (typeof window !== "undefined") {
  if (!sessionStorage.getItem("analytics_session_id")) {
    analytics.startSession();
  }
}
