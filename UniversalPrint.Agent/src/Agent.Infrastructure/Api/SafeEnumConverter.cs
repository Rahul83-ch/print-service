/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Agent.Infrastructure.Api
{
    /// <summary>
    /// Resilient JSON converter for enum types that falls back gracefully to default values 
    /// instead of throwing exceptions on unrecognized string or integer values.
    /// </summary>
    public class SafeEnumConverter<T> : JsonConverter<T> where T : struct, Enum
    {
        public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.String)
            {
                string enumText = reader.GetString();
                if (string.IsNullOrEmpty(enumText))
                {
                    return default;
                }

                if (Enum.TryParse<T>(enumText, true, out T result))
                {
                    return result;
                }

                // Log or carry on with fallback safely
                return default;
            }
            else if (reader.TokenType == JsonTokenType.Number)
            {
                if (reader.TryGetInt32(out int enumVal))
                {
                    if (Enum.IsDefined(typeof(T), enumVal))
                    {
                        return (T)(object)enumVal;
                    }
                }
                return default;
            }

            return default;
        }

        public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
        {
            writer.WriteStringValue(value.ToString());
        }
    }

    /// <summary>
    /// Factory that instantiates the SafeEnumConverter for any Enum target.
    /// </summary>
    public class SafeEnumConverterFactory : JsonConverterFactory
    {
        public override bool CanConvert(Type typeToConvert)
        {
            return typeToConvert.IsEnum;
        }

        public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
        {
            Type converterType = typeof(SafeEnumConverter<>).MakeGenericType(typeToConvert);
            return (JsonConverter)Activator.CreateInstance(converterType);
        }
    }
}
