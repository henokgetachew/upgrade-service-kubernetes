class MessageService {

    constructor(){

    }

    // I think it's confusing to have "not implemented" files in a repository.
    sendMessageToSlack(channelName: string, tokenString: string): boolean {
        throw new Error('Not yet implemented');
    }

}

module.exports = MessageService;
