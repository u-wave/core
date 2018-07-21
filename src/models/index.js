import aclRoleModel from './AclRole';
import authenticationModel from './Authentication';
import historyModel from './History';
import mediaModel from './Media';
import playlistModel from './Playlist';
import playlistItemModel from './PlaylistItem';
import userModel from './User';

export default function models() {
  return (uw) => {
    uw.use(aclRoleModel());
    uw.use(authenticationModel());
    uw.use(historyModel());
    uw.use(mediaModel());
    uw.use(playlistModel());
    uw.use(playlistItemModel());
    uw.use(userModel());

    uw.models = {
      AclRole: uw.model('AclRole'),
      Authentication: uw.model('Authentication'),
      HistoryEntry: uw.model('History'),
      Media: uw.model('Media'),
      Playlist: uw.model('Playlist'),
      PlaylistItem: uw.model('PlaylistItem'),
      User: uw.model('User'),
    };
  };
}
