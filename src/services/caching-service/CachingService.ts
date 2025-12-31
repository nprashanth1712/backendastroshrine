import Redis from "ioredis";
import { createClient } from "redis";
import Keyv from "keyv";
import { createCache } from "cache-manager";
import { CacheableMemory } from "cacheable";
import { AstrologerViewCache } from "../../types/astrologer/Astrologer";


const cache = createCache({
	stores: [
		new Keyv({
			store: new CacheableMemory({ ttl: 0, lruSize: 5000 }),
		}),
	],
});

export const getCacheByKey = async ({ cacheKey }: { cacheKey: string }) => {
	try {
		const cachedData = await cache.get(cacheKey);
		console.log("GETCACHEDATA ", JSON.parse(cachedData as string));
		console.log(cachedData)
		if (cachedData) return JSON.parse(cachedData as string)
		else {
			return null;
		}
	} catch (error) {
		console.log("Error while connecting cacheClient ", error);
		throw error;
	}
};

export const setCacheData = async ({ cacheKey, data }: { cacheKey: string; data: any }) => {
	try {
		const response = await cache.set(cacheKey, JSON.stringify(data));
		console.log("setCacheData response ", response);
		return;
	} catch (error) {
		console.log("Error while connecting cacheClient ", error);
		throw error;
	}
};

export const getCacheList = async () => {
    try {
        const keys = cache.stores;
        const items = (keys[0].store as CacheableMemory).items;
        let listOfItems: AstrologerViewCache[] = [];
        let something = items.next();
        while (!something.done) {
            console.log("total nuymber of keys are ", JSON.parse(JSON.parse(something.value.value).value))
            listOfItems.push(JSON.parse(JSON.parse(something.value.value).value))
            
            something = items.next()
        }
        console.log("THE FINAL LIST ", listOfItems);
        return listOfItems as AstrologerViewCache[];
    } catch(error) {
        console.log("error in getCacheList", error)
    }
}
