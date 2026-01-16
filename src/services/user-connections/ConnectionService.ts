import { invalidParameter } from "../../utils/ErrorUtils";
// Supabase Migration: Using Supabase DAOs instead of DynamoDB
import { FollowersDao } from "../../data-access-supabase/FollowersDao";

// Adapter functions to match the old DynamoDB interface
const addHostFollower = FollowersDao.followAstrologer.bind(FollowersDao);
const getHostFollowerList = FollowersDao.getAstrologerFollowers.bind(FollowersDao);
const getUserFollowingList = FollowersDao.getUserFollowing.bind(FollowersDao);
const getHostAndUserFollowData = FollowersDao.getFollowRelationsBatch.bind(FollowersDao);

// todo add for each connection type 
const userConnectionHandler = ({type}: {type: string}) => {
    switch(type.toUpperCase()) {
        case "FOLLOWER": 
            return addHostFollower;
        default: 
            throw {
                statusCode: 400,
                code: 'INVALID_PARAM',
                message: invalidParameter(status)
            }
    };
}
export { userConnectionHandler }