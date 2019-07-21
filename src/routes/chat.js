import router from 'router';
import route from '../route';
import * as validations from '../validations';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/chat';

export default function chatRoutes() {
  return router()
    // DELETE /chat/ - Clear the chat (delete all messages).
    .delete(
      '/',
      protect('chat.delete'),
      route(controller.deleteAll),
    )
    // DELETE /chat/user/:id - Delete all messages by a user.
    .delete(
      '/user/:id',
      protect('chat.delete'),
      checkFields(validations.deleteChatByUser),
      route(controller.deleteByUser),
    )
    // DELETE /chat/:id - Delete a chat message.
    .delete(
      '/:id',
      protect('chat.delete'),
      checkFields(validations.deleteChatMessage),
      route(controller.deleteMessage),
    );
}
