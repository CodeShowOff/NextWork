export const supportedLocales = ['en', 'en-XA'] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const localeLabels: Record<SupportedLocale, string> = {
  en: 'English',
  'en-XA': 'Pseudo (Long)',
};

export const resources = {
  en: {
    translation: {
      app: {
        tabs: {
          feed: 'Feed',
          groups: 'Groups',
          search: 'Search',
          messages: 'Messages',
          notifications: 'Notifications',
          profile: 'Profile',
        },
        stack: {
          post: 'Post',
          conversation: 'Conversation',
        },
        alerts: {
          inviteAcceptedTitle: 'Invite accepted',
          inviteAcceptedBody: 'You have joined the organization and switched context.',
          inviteAcceptFailedTitle: 'Could not accept invite link',
        },
      },
      common: {
        loading: 'Loading...',
        actions: {
          save: 'Save',
          continue: 'Continue',
          back: 'Back',
          next: 'Next',
          skip: 'Skip',
          start: 'Start',
          create: 'Create',
          share: 'Share',
          signOut: 'Sign out',
          cancel: 'Cancel',
          mute: 'Mute',
        },
      },
      auth: {
        title: 'Workplace',
        subtitle: 'Sign in to access feed, groups, messages, and profile.',
        modeLogin: 'Login',
        modeSignup: 'Sign Up',
        stepTitle: 'Signup step {{current}}/{{total}}',
        stepLabels: {
          email: 'Email',
          password: 'Password',
          fullName: 'Full name',
          organizationName: 'Organization name',
          organizationSize: 'Organization size',
          jobTitle: 'Job title',
        },
        placeholders: {
          email: 'Email',
          password: 'Password',
          fullName: 'Full name',
          organizationName: 'Organization name',
          organizationSize: 'Organization size (e.g. 1-10, 11-50)',
          jobTitle: 'Job title',
          apiUrl: 'API URL (optional)',
          realtimeUrl: 'Realtime URL (optional)',
        },
        alerts: {
          missingFieldsTitle: 'Missing fields',
          missingLoginFieldsBody: 'Email and password are required.',
          missingSignupFieldsBody: 'Complete all signup steps before continuing.',
          missingStepFieldBody: 'Please enter {{field}}.',
          authFailedTitle: 'Authentication failed',
        },
        buttons: {
          pleaseWait: 'Please wait...',
          continue: 'Continue',
        },
      },
      feed: {
        composer: {
          placeholder: 'Share an update',
          removeImage: 'Remove image',
          attachImage: 'Attach image',
          post: 'Post',
          posting: 'Posting...',
        },
        targeting: {
          label: 'Post target',
          global: 'Global',
          globalPost: 'Global post',
          groupLabel: 'Group: {{groupName}}',
          unknownGroup: 'Unknown group',
        },
        actions: {
          like: 'Like',
          unlike: 'Unlike',
          comments: 'Comments',
        },
        stats: '{{likes}} likes · {{comments}} comments',
        alerts: {
          createPostFailedTitle: 'Could not create post',
          writeBeforePosting: 'Write something before posting.',
          permissionRequiredTitle: 'Permission required',
          permissionRequiredBody: 'Allow photo access to attach images.',
          updateLikeFailedTitle: 'Could not update like',
        },
        empty: {
          noPosts: 'No posts in your feed yet.',
        },
        detail: {
          commentCount: '{{count}} comments',
          emptyComments: 'No comments yet.',
          replyingTo: 'Replying to {{name}}',
          replyToPlaceholder: 'Reply to {{name}}',
          writeCommentPlaceholder: 'Write a comment',
          actions: {
            reply: 'Reply',
            delete: 'Delete',
            send: 'Send',
          },
          alerts: {
            createCommentFailed: 'Could not create comment',
            deleteCommentFailed: 'Could not delete comment',
          },
        },
      },
      groups: {
        title: {
          createOrganization: 'Create your organization',
          joinWithInvite: 'Join with invite token',
          chooseStarterGroups: 'Choose starter groups',
          activeOrganization: 'Active organization',
        },
        subtitle: {
          createOrganization: 'Start by creating a workspace for your team.',
          chooseStarterGroups: 'Pick the groups you want to create now. You can skip and add later.',
          groupsCount: 'Groups: {{count}}',
          membersCount: 'Members: {{count}}',
          noMembers: 'No members to show.',
          noGroups: 'No groups yet.',
        },
        placeholders: {
          organizationName: 'Organization name',
          inviteToken: 'Invite token',
          createGroup: 'Create a new group',
        },
        buttons: {
          createOrganization: 'Create organization',
          creatingOrganization: 'Creating organization...',
          acceptInvite: 'Accept invite',
          acceptingInvite: 'Accepting invite...',
          continue: 'Continue',
          generateInvite: 'Generate invite link',
          shareInvite: 'Share invite',
          join: 'Join',
          hideMembers: 'Hide members',
          viewMembers: 'View members',
          create: 'Create',
          working: 'Working...',
        },
        firstRun: {
          title: 'Invite your teammates',
          subtitle: 'Share an invite now so your team can join this workspace before you continue.',
          continueToApp: 'Continue to app',
        },
        labels: {
          inviteLink: 'Invite link: {{url}}',
          inviteToken: 'Invite token: {{token}}',
          memberDate: '{{date}}',
          memberCount: '{{count}} members',
          switchingOrganization: 'Switching organization...',
          checkboxChecked: 'x',
        },
        alerts: {
          createOrganizationFailed: 'Could not create organization',
          switchOrganizationFailed: 'Could not switch organization',
          joinGroupFailed: 'Could not join group',
          joinGroupSuccessTitle: 'Joined group',
          joinGroupSuccessBody: 'You are now a member of this group.',
          createGroupFailed: 'Could not create group',
          createInviteFailed: 'Could not create invite',
          shareInviteFailed: 'Could not share invite',
          initializeStarterGroupsFailed: 'Could not initialize starter groups',
          onboardingCompleteTitle: 'Onboarding complete',
          onboardingCompleteBody: 'Starter groups are ready.',
          acceptInviteFailed: 'Could not accept invite',
          acceptInviteSuccessTitle: 'Invite accepted',
          acceptInviteSuccessBody: 'You have joined the organization.',
          inviteShareMessage: 'Join {{orgName}} on Workplace: {{url}}',
          defaultOrgName: 'our organization',
        },
      },
      search: {
        title: 'Search',
        placeholder: 'Search people, groups, posts',
        hint: 'Search users, groups, and posts.',
        noMatches: 'No matches found for "{{query}}".',
        error: 'Could not run search right now.',
        sections: {
          users: 'Users',
          groups: 'Groups',
          posts: 'Posts',
        },
      },
      messages: {
        setup: {
          title: 'Messaging setup',
          helper: 'Enter your access token and user ID from backend auth endpoints to start messaging.',
          placeholders: {
            userId: 'User ID',
            accessToken: 'Access token',
            apiBaseUrl: 'API base URL (optional)',
            realtimeUrl: 'Realtime URL (optional)',
          },
          saveSession: 'Save session',
        },
        toolbar: {
          directPlaceholder: 'Start direct chat with user ID',
          start: 'Start',
          signOut: 'Sign out',
        },
        list: {
          empty: 'No conversations yet. Start one above.',
          noMessagesYet: 'No messages yet',
          directChatFallback: 'Direct chat',
        },
        detail: {
          empty: 'No messages yet. Say hi.',
          typingSingle: '{{name}} is typing...',
          typingMultiple: '{{names}} are typing...',
          unknownActor: 'Someone',
        },
        composer: {
          placeholder: 'Type a message',
          send: 'Send',
          sending: '...',
        },
        alerts: {
          createConversationFailed: 'Could not create conversation',
          missingFieldsTitle: 'Missing fields',
          missingFieldsBody: 'User ID and access token are required.',
        },
      },
      notifications: {
        title: 'Notifications',
        markAllRead: 'Mark all read',
        preferences: {
          title: 'Preferences',
          likes: 'Likes',
          comments: 'Comments',
          follows: 'Follows',
          messages: 'Messages',
        },
        mutedActors: {
          title: 'Muted actors',
          empty: 'No muted actors.',
        },
        list: {
          empty: 'No notifications yet.',
        },
        item: {
          unknownActor: 'Someone',
          follow: '{{actor}} started following you',
          like: '{{actor}} liked your post',
          comment: '{{actor}} commented on your post',
          message: '{{actor}} sent you a message',
          fallback: '{{actor}} sent a notification',
          muteHint: 'Long press to mute this actor',
        },
        alerts: {
          postUnavailableTitle: 'Post unavailable',
          postUnavailableBody: 'Refreshing feed to locate this post.',
          muteTitle: 'Mute notifications',
          muteBody: 'Mute notifications from {{name}}?',
        },
      },
      profile: {
        title: {
          mine: 'My Profile',
          other: 'Profile',
        },
        subtitle: {
          email: 'Email: {{email}}',
          hidden: 'Hidden',
        },
        relationship: {
          self: 'This is you',
          following: 'Following',
          notFollowing: 'Not following',
        },
        metrics: {
          followers: 'Followers',
          following: 'Following',
          posts: 'Posts',
        },
        placeholders: {
          displayName: 'Display name',
          bio: 'Bio',
          avatarUrl: 'Avatar URL',
          jobTitle: 'Job title',
          organizationSize: 'Organization size',
        },
        buttons: {
          saveProfile: 'Save profile',
          follow: 'Follow',
          unfollow: 'Unfollow',
          signOut: 'Sign out',
        },
        postStats: '{{likes}} likes · {{comments}} comments',
        emptyPosts: 'No posts yet.',
        followList: {
          empty: 'No users found.',
        },
        edit: {
          title: 'Profile',
          emailLoading: 'Loading...',
        },
        alerts: {
          savedTitle: 'Saved',
          savedBody: 'Your profile was updated.',
          updateProfileFailed: 'Could not update profile',
          updateFollowFailed: 'Could not update follow status',
        },
      },
    },
  },
  'en-XA': {
    translation: {
      app: {
        tabs: {
          feed: '[Feed - Expanded]',
          groups: '[Groups - Expanded]',
          search: '[Search - Expanded]',
          messages: '[Messages - Expanded]',
          notifications: '[Notifications - Expanded]',
          profile: '[Profile - Expanded]',
        },
      },
      common: {
        loading: '[Loading in progress...]',
      },
    },
  },
} as const;
