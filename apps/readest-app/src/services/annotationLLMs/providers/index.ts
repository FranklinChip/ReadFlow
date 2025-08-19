import { AnnotationProvider } from '../types';
import { qwenProvider } from './qwen';

const availableProviders = [qwenProvider];

export type AnnotationProviderName = (typeof availableProviders)[number]['name'];

export const getAnnotationProvider = (name: AnnotationProviderName): AnnotationProvider | undefined => {
  return availableProviders.find((provider) => provider.name === name);
};

export const getAnnotationProviders = (): AnnotationProvider[] => {
  return availableProviders;
};

export { qwenProvider };
