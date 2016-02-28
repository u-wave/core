import AuthenticationSchema from './Authentication';
import HistorySchema from './History';
import MediaSchema from './Media';
import PlaylistSchema from './Playlist';
import PlaylistItemSchema from './PlaylistItem';
import UserSchema from './User';

function model(uw, name, schemaCreator) {
  const Schema = schemaCreator(uw);
  uw.mongo.model(name, new Schema);
}

export default function models() {
  return uw => {
    model(uw, 'Authentication', AuthenticationSchema);
    model(uw, 'History', HistorySchema);
    model(uw, 'Media', MediaSchema);
    model(uw, 'Playlist', PlaylistSchema);
    model(uw, 'PlaylistItem', PlaylistItemSchema);
    model(uw, 'User', UserSchema);
  };
}
