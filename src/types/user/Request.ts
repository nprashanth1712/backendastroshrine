import { Request } from "express";
import { EndUser, UserProfile } from "./models/User";
import { HostProfile } from "../astrologer/Astrologer";
export interface AddUserRequest extends Request {
  body: EndUser;
}

export interface DeleteUserRequest extends Request {
  params: {
    id: string;
  };
}

export interface GetUserRequest extends Request {
  params: {
    id: string;
  };
}

export interface UpdateUserProfileRequest extends Request {
  params: {
    id: string;
  };
  body: {
    profile: UserProfile;
  };
}

export interface UpdateUserProfilePicRequest extends Request {
  avatar?: string;
  files?: any;
}

export interface UploadHostMediaRequest extends Request {
  files?: any;
}
export interface UpdateUserProfileDataRequest extends Request {
  body: {
    profile: UserProfile;
    name: string;
  };
}

export interface UpdateHostProfileDataRequest extends Request {
  body: {
    name: string;
    profile: HostProfile;
  };
}
