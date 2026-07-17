import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { Group, listGroupMembers } from '../../shared/api/groups.api';

type GroupDetailPageProps = {
  group: Group;
  fallbackArtwork: ImageSourcePropType | null;
  onBack: () => void;
};

type GroupTabKey = 'chat' | 'photos' | 'events' | 'files' | 'albums';

type GroupPost = {
  id: string;
  authorName: string;
  publishedAt: string;
  content: string;
};

const tabLabels: Array<{ key: GroupTabKey; label: string }> = [
  { key: 'chat', label: 'Chat' },
  { key: 'photos', label: 'Photos' },
  { key: 'events', label: 'Events' },
  { key: 'files', label: 'Files' },
  { key: 'albums', label: 'Albums' },
];

const starterPosts: GroupPost[] = [
  {
    id: 'seed-post-1',
    authorName: 'Florian Bamba',
    publishedAt: 'Thursday at 14:04',
    content: 'Take a look at the new spring/summer palette and give me your feedback!',
  },
  {
    id: 'seed-post-2',
    authorName: 'Alicia Kim',
    publishedAt: 'Wednesday at 09:12',
    content: 'Let us lock this week\'s campaign files in the shared folder before lunch.',
  },
];

function getPrivacyLabel(groupPrivacy: string) {
  if (groupPrivacy.toLowerCase() === 'closed') {
    return 'CLOSED GROUP';
  }
  if (groupPrivacy.toLowerCase() === 'secret') {
    return 'SECRET GROUP';
  }
  return 'OPEN GROUP';
}

function avatarBgFromSeed(seed: string) {
  const colors = ['#DBEAFE', '#FCE7F3', '#DCFCE7', '#FEF3C7', '#E0E7FF', '#FFE4E6'];
  const index = seed.split('').reduce((acc, current) => acc + current.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export function GroupDetailPage({ group, fallbackArtwork, onBack }: GroupDetailPageProps) {
  const [activeTab, setActiveTab] = useState<GroupTabKey>('chat');
  const [searchValue, setSearchValue] = useState('');
  const [composerValue, setComposerValue] = useState('');
  const [posts, setPosts] = useState<GroupPost[]>(starterPosts);

  const membersQuery = useQuery({
    queryKey: ['groups', 'members', group.id, 'detail'],
    queryFn: () => listGroupMembers(group.id),
  });

  const members = membersQuery.data?.items ?? [];

  const visiblePosts = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return posts;
    }

    return posts.filter(
      (post) =>
        post.authorName.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query),
    );
  }, [posts, searchValue]);

  const heroSource = group.photoUrl
    ? ({ uri: group.photoUrl } as ImageSourcePropType)
    : (fallbackArtwork ?? null);

  const memberPreview = members.slice(0, 7);

  const submitPost = () => {
    const next = composerValue.trim();
    if (!next) {
      return;
    }

    setPosts((current) => [
      {
        id: `post-${Date.now()}`,
        authorName: 'You',
        publishedAt: 'Just now',
        content: next,
      },
      ...current,
    ]);
    setComposerValue('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.pageHeadline}>Collaborate in Groups with unlimited file sharing</Text>

        <View style={styles.heroCard}>
          {heroSource ? (
            <Image source={heroSource} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroFallback]} />
          )}

          <View style={styles.heroTopRow}>
            <Pressable onPress={onBack} style={styles.heroIconButton}>
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={22} color="#E5E7EB" />
              <TextInput
                value={searchValue}
                onChangeText={setSearchValue}
                placeholder={`Search in ${group.name}`}
                placeholderTextColor="#E5E7EB"
                style={styles.searchInput}
              />
            </View>
            <Pressable
              onPress={() => {
                Alert.alert('Group Info', `${group.name}\n${group.groupType}\n${group.groupPrivacy}`);
              }}
              style={styles.heroIconButton}
            >
              <MaterialIcons name="info-outline" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.groupHeaderCard}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupMeta}>{`${getPrivacyLabel(group.groupPrivacy)} · ${group.memberCount} MEMBERS`}</Text>

          <View style={styles.memberAvatarRow}>
            {membersQuery.isLoading ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              memberPreview.map((member) => (
                <View
                  key={`${member.userId}-${member.joinedAt}`}
                  style={[
                    styles.memberAvatar,
                    { backgroundColor: avatarBgFromSeed(member.displayName) },
                  ]}
                >
                  <Text style={styles.memberAvatarText}>{member.displayName.slice(0, 1).toUpperCase()}</Text>
                </View>
              ))
            )}

            <Pressable
              style={styles.addMemberButton}
              onPress={() => Alert.alert('Invite members', 'Use organization invite link to add people to this group.')}
            >
              <MaterialIcons name="add" size={28} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {tabLabels.map((tab) => (
              <Pressable
                key={tab.key}
                style={[styles.tabChip, activeTab === tab.key ? styles.tabChipActive : null]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabChipText, activeTab === tab.key ? styles.tabChipTextActive : null]}>{tab.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {activeTab === 'chat' ? (
          <>
            <View style={styles.composerCard}>
              <View style={styles.composerAvatar}>
                <Text style={styles.composerAvatarText}>Y</Text>
              </View>
              <TextInput
                value={composerValue}
                onChangeText={setComposerValue}
                placeholder="Write something..."
                style={styles.composerInput}
              />
              <Pressable style={styles.composerIconButton} onPress={() => Alert.alert('Camera', 'Attach photo flow can be connected here.')}>
                <MaterialIcons name="photo-camera" size={24} color="#9CA3AF" />
              </Pressable>
              <Pressable style={styles.composerIconButton} onPress={() => Alert.alert('Live', 'Live video flow can be connected here.')}>
                <MaterialIcons name="videocam" size={24} color="#9CA3AF" />
              </Pressable>
              <Pressable style={styles.composerIconButton} onPress={() => Alert.alert('More', 'More composer actions can be added here.')}>
                <MaterialIcons name="more-horiz" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            <Pressable style={styles.postButton} onPress={submitPost}>
              <Text style={styles.postButtonText}>Post</Text>
            </Pressable>

            {visiblePosts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeaderRow}>
                  <View style={styles.postAuthorAvatar}>
                    <Text style={styles.postAuthorAvatarText}>{post.authorName.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.postHeaderTextCol}>
                    <Text style={styles.postAuthorName}>{post.authorName}</Text>
                    <View style={styles.postMetaRow}>
                      <Text style={styles.postMetaText}>{post.publishedAt}</Text>
                      <MaterialIcons name="public" size={14} color="#9CA3AF" />
                    </View>
                  </View>
                  <Pressable onPress={() => Alert.alert('Post options', 'Edit, pin, or delete actions can be wired here.')}>
                    <MaterialIcons name="more-horiz" size={24} color="#9CA3AF" />
                  </Pressable>
                </View>
                <Text style={styles.postContent}>{post.content}</Text>
              </View>
            ))}

            {!visiblePosts.length ? (
              <Text style={styles.emptyStateText}>No chat posts match your search.</Text>
            ) : null}
          </>
        ) : null}

        {activeTab === 'photos' ? (
          <View style={styles.contentCard}>
            <Text style={styles.contentTitle}>Recent Photos</Text>
            <View style={styles.photoGrid}>
              {[1, 2, 3, 4].map((item) => (
                <View key={`photo-${item}`} style={styles.photoItem}>
                  {heroSource ? <Image source={heroSource} style={styles.photoImage} /> : <View style={styles.photoImage} />}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {activeTab === 'events' ? (
          <View style={styles.contentCard}>
            <Text style={styles.contentTitle}>Upcoming Events</Text>
            <View style={styles.listTile}>
              <MaterialIcons name="event" size={20} color="#2563EB" />
              <Text style={styles.listTileText}>Brand Sync - Friday 11:00 AM</Text>
            </View>
            <View style={styles.listTile}>
              <MaterialIcons name="event" size={20} color="#2563EB" />
              <Text style={styles.listTileText}>Campaign Review - Monday 2:00 PM</Text>
            </View>
          </View>
        ) : null}

        {activeTab === 'files' ? (
          <View style={styles.contentCard}>
            <Text style={styles.contentTitle}>Shared Files</Text>
            <View style={styles.listTile}>
              <MaterialIcons name="insert-drive-file" size={20} color="#2563EB" />
              <Text style={styles.listTileText}>Spring-Summer-Palette.pdf</Text>
            </View>
            <View style={styles.listTile}>
              <MaterialIcons name="insert-drive-file" size={20} color="#2563EB" />
              <Text style={styles.listTileText}>Campaign-Assets.zip</Text>
            </View>
            <Text style={styles.filesHint}>Unlimited file sharing is enabled for this group.</Text>
          </View>
        ) : null}

        {activeTab === 'albums' ? (
          <View style={styles.contentCard}>
            <Text style={styles.contentTitle}>Albums</Text>
            <View style={styles.listTile}>
              <MaterialIcons name="collections" size={20} color="#2563EB" />
              <Text style={styles.listTileText}>Q2 Inspiration</Text>
            </View>
            <View style={styles.listTile}>
              <MaterialIcons name="collections" size={20} color="#2563EB" />
              <Text style={styles.listTileText}>Team Workshop</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECECEC',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  pageHeadline: {
    color: '#374151',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
    marginHorizontal: 22,
    marginTop: 14,
    marginBottom: 14,
  },
  heroCard: {
    marginHorizontal: 10,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0F172A',
    backgroundColor: '#111827',
  },
  heroImage: {
    width: '100%',
    height: 250,
  },
  heroFallback: {
    backgroundColor: '#6B7280',
  },
  heroTopRow: {
    position: 'absolute',
    top: 14,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(17,24,39,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  groupHeaderCard: {
    marginTop: 10,
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  groupName: {
    fontSize: 45,
    lineHeight: 50,
    color: '#111827',
    fontWeight: '800',
  },
  groupMeta: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 18,
    fontWeight: '700',
  },
  memberAvatarRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: -6,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#111827',
    fontWeight: '800',
  },
  addMemberButton: {
    marginLeft: 10,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    marginTop: 14,
    paddingRight: 8,
    gap: 8,
  },
  tabChip: {
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tabChipActive: {
    backgroundColor: '#D1D5DB',
  },
  tabChipText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 16,
  },
  tabChipTextActive: {
    color: '#030712',
  },
  composerCard: {
    marginTop: 10,
    marginHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerAvatarText: {
    color: '#312E81',
    fontWeight: '800',
  },
  composerInput: {
    flex: 1,
    color: '#111827',
    fontSize: 18,
  },
  composerIconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButton: {
    marginTop: 8,
    marginHorizontal: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  postCard: {
    marginTop: 10,
    marginHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  postHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postAuthorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAuthorAvatarText: {
    color: '#1F2937',
    fontWeight: '700',
  },
  postHeaderTextCol: {
    flex: 1,
  },
  postAuthorName: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '800',
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postMetaText: {
    color: '#6B7280',
  },
  postContent: {
    marginTop: 10,
    color: '#111827',
    fontSize: 18,
    lineHeight: 26,
  },
  emptyStateText: {
    marginTop: 16,
    marginHorizontal: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 16,
  },
  contentCard: {
    marginTop: 10,
    marginHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  contentTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoItem: {
    width: '48.5%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#E5E7EB',
  },
  photoImage: {
    width: '100%',
    height: 120,
  },
  listTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  listTileText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  filesHint: {
    marginTop: 6,
    color: '#2563EB',
    fontWeight: '600',
  },
});
