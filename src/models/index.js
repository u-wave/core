import AclRoleSchema from './AclRole';
import AuthenticationSchema from './Authentication';
import HistorySchema from './History';
import MediaSchema from './Media';
import PlaylistSchema from './Playlist';
import PlaylistItemSchema from './PlaylistItem';
import UserSchema from './User';

function installModel(uw, name, schemaCreator) {
  const Schema = schemaCreator(uw);
  uw.mongo.model(name, new Schema());
}

export default function models() {
  return (uw) => {
    installModel(uw, 'AclRole', AclRoleSchema);
    installModel(uw, 'Authentication', AuthenticationSchema);
    installModel(uw, 'History', HistorySchema);
    installModel(uw, 'Media', MediaSchema);
    installModel(uw, 'Playlist', PlaylistSchema);
    installModel(uw, 'PlaylistItem', PlaylistItemSchema);
    installModel(uw, 'User', UserSchema);
  };
}
